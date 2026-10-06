#!/usr/bin/env node
/**
 * Integration check: build each council's uploader page URL from councils.csv
 * and verify it returns HTTP 200.
 *
 * The URL path is "/council-tax/<lad_code>-<clean_name>.html". The clean_name
 * logic MUST mirror modules/render_council/main.tf, which produces the real S3
 * object key:
 *   clean-council-name2 = replace(replace(name, "/[^A-Za-z0-9-_ ]/", ""), " ", "-")
 *   council-filename    = "${lad_code}-${clean-council-name2}.html"
 * i.e. strip anything that is not [A-Za-z0-9-_ ], then replace spaces with "-".
 * Note this means names containing "&" (e.g. "EPSOM & EWELL") become
 * "EPSOM--EWELL" because the "&" is removed and its surrounding spaces each
 * become a dash.
 *
 * Usage:
 *   node check_council_urls.js --base <base-domain> [--csv <path>]
 *                              [--concurrency <n>] [--retries <n>]
 *
 * --base is the full uploader host for the target environment, e.g.
 * "uploader.ingest-dev.aws.onsdigital.uk". In CI it is derived from the same
 * env tfvars Terraform applies (see ci/tasks/integrationTests/task.sh), so the
 * check always targets the environment the pipeline is deploying. When run
 * locally it defaults to dev for convenience.
 *
 * Exits 0 if every URL returns 200, non-zero otherwise (listing failures).
 */

"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

const DEFAULTS = {
  base: "uploader.ingest-dev.aws.onsdigital.uk",
  concurrency: 10,
  retries: 3,
  retryDelayMs: 2000,
  timeoutMs: 10000,
};

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  const projectRoot = findProjectRoot(__dirname);
  args.csv = path.join(projectRoot, "councils.csv");

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    switch (key) {
      case "--base":
        args.base = value;
        i += 1;
        break;
      case "--csv":
        args.csv = value;
        i += 1;
        break;
      case "--concurrency":
        args.concurrency = Number(value);
        i += 1;
        break;
      case "--retries":
        args.retries = Number(value);
        i += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${key}`);
    }
  }
  return args;
}

function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (path.basename(dir) === "aws-uploader") return dir;
    dir = path.dirname(dir);
  }
  // Fallback: assume repo root is two levels up from test/integration
  return path.resolve(startDir, "..", "..");
}

/**
 * Mirrors modules/render_council/main.tf clean-council-name2.
 */
function cleanCouncilName(name) {
  return name.replace(/[^A-Za-z0-9\-_ ]/g, "").replace(/ /g, "-");
}

/**
 * Minimal CSV line splitter. councils.csv has no quoted fields or embedded
 * commas (the onboarding script strips commas from names), so a plain split is
 * sufficient and keeps this dependency-free.
 */
function parseCsv(contents) {
  const lines = contents
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  const ladIdx = header.indexOf("lad_code");
  if (nameIdx === -1 || ladIdx === -1) {
    throw new Error(
      `councils.csv must have "name" and "lad_code" headers, got: ${header.join(",")}`,
    );
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const name = cols[nameIdx];
    const ladCode = cols[ladIdx];
    if (!name || !ladCode) continue;
    rows.push({ name, ladCode });
  }
  return rows;
}

function buildUrl(base, row) {
  const fileName = `${row.ladCode}-${cleanCouncilName(row.name)}.html`;
  return `https://${base}/council-tax/${fileName}`;
}

function requestOnce(url, timeoutMs) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: "GET" }, (res) => {
      // Drain the body so the socket is freed.
      res.resume();
      resolve({ status: res.statusCode });
    });
    req.on("error", (err) => resolve({ status: 0, error: err.message }));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve({ status: 0, error: `timeout after ${timeoutMs}ms` });
    });
    req.end();
  });
}

async function checkUrl(url, opts) {
  let last = { status: 0, error: "no attempt made" };
  for (let attempt = 1; attempt <= opts.retries; attempt += 1) {
    last = await requestOnce(url, opts.timeoutMs);
    if (last.status === 200) {
      return { url, ok: true, status: 200, attempts: attempt };
    }
    if (attempt < opts.retries) {
      await new Promise((r) => setTimeout(r, opts.retryDelayMs));
    }
  }
  return {
    url,
    ok: false,
    status: last.status,
    error: last.error,
    attempts: opts.retries,
  };
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (true) {
      const idx = next;
      next += 1;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const runners = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i += 1) {
    runners.push(runner());
  }
  await Promise.all(runners);
  return results;
}

async function main() {
  const args = parseArgs(process.argv);

  const contents = fs.readFileSync(args.csv, "utf8");
  const rows = parseCsv(contents);
  if (rows.length === 0) {
    console.error(`No councils found in ${args.csv}`);
    process.exit(1);
  }

  const urls = rows.map((row) => ({ row, url: buildUrl(args.base, row) }));

  console.log(
    `Checking ${urls.length} council URLs against ${args.base} ` +
      `(concurrency=${args.concurrency}, retries=${args.retries})\n`,
  );

  const results = await runPool(urls, args.concurrency, async ({ row, url }) => {
    const result = await checkUrl(url, {
      retries: args.retries,
      retryDelayMs: args.retryDelayMs,
      timeoutMs: args.timeoutMs,
    });
    return { name: row.name, ladCode: row.ladCode, ...result };
  });

  const failures = results.filter((r) => !r.ok);
  const passed = results.length - failures.length;

  for (const r of results) {
    if (r.ok) {
      console.log(`  OK   ${r.status} ${r.url}`);
    } else {
      const detail = r.error ? ` (${r.error})` : "";
      console.log(`  FAIL ${r.status}${detail} ${r.url}`);
    }
  }

  console.log(`\n${passed}/${results.length} council URLs returned 200.`);

  if (failures.length > 0) {
    console.error(`\n${failures.length} council URL(s) failed:`);
    for (const f of failures) {
      const detail = f.error ? ` (${f.error})` : "";
      console.error(`  - ${f.name} [${f.ladCode}] -> ${f.status}${detail}`);
    }
    process.exit(1);
  }

  console.log("All council URLs are up.");
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.stack || err.message}`);
  process.exit(1);
});
