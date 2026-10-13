#!/usr/bin/env node
"use strict";

// Smoke test for the generic (multi-service) uploader.
//
// For every service defined under services/ (one services/<id>/service.yaml
// per service, the same source of truth Terraform's local.services loads),
// this derives the published page URL for each row of that service's
// onboarding CSV and checks it returns 200. It then runs one negative check
// per service (a non-existent LAD code must NOT return 200), so a mis-pointed
// origin can't pass silently.
//
// Dependency-free (Node built-ins only) so it runs on the plain node:18 image
// used by the Concourse smokeTests task.
//
// The URL/key derivation mirrors modules/render_service exactly:
//   https://<base>/<service_id>/<lad_code>-<clean-name>.html
// where clean-name = name with any char outside [A-Za-z0-9-_ ] stripped, then
// spaces replaced with "-".

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
  args.projectRoot = findProjectRoot(__dirname);
  args.servicesDir = path.join(args.projectRoot, "services");
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    switch (key) {
      case "--base":
        args.base = value;
        i += 1;
        break;
      case "--services":
        args.servicesDir = value;
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
  return path.resolve(startDir, "..", "..");
}

// Must match modules/render_service: replace(replace(name,
// "/[^A-Za-z0-9-_ ]/", ""), " ", "-").
function cleanCouncilName(name) {
  return name.replace(/[^A-Za-z0-9\-_ ]/g, "").replace(/ /g, "-");
}

// Pull a single scalar field (e.g. onboarding_csv) out of a service.yaml.
// Dependency-free: the field is a simple `key: value` line, optionally quoted
// and optionally followed by a comment, so a narrow regex is enough and we
// avoid adding a YAML parser to the plain node:18 smoke image.
function parseYamlScalar(yamlContents, key) {
  const re = new RegExp(
    `^\\s*${key}\\s*:\\s*["']?([^"'\\n#]+?)["']?\\s*(?:#.*)?$`,
    "m",
  );
  const m = yamlContents.match(re);
  return m ? m[1].trim() : undefined;
}

// Discover services by scanning services/<id>/service.yaml. The folder name is
// the service id (matching Terraform's local.services keying), and each
// service's onboarding CSV comes from its service.yaml `onboarding_csv` field
// (falling back to the conventional services/<id>/users.csv).
function discoverServices(servicesDir) {
  let entries;
  try {
    entries = fs.readdirSync(servicesDir, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Could not read services directory ${servicesDir}: ${err.message}`);
  }
  const services = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const serviceYaml = path.join(servicesDir, entry.name, "service.yaml");
    if (!fs.existsSync(serviceYaml)) continue;
    const yamlContents = fs.readFileSync(serviceYaml, "utf8");
    const serviceId = parseYamlScalar(yamlContents, "service_id") || entry.name;
    const csv =
      parseYamlScalar(yamlContents, "onboarding_csv") ||
      `services/${entry.name}/users.csv`;
    services.push({ serviceId, csv });
  }
  if (services.length === 0) {
    throw new Error(`No <service>/service.yaml files found under ${servicesDir}`);
  }
  return services;
}

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
      `onboarding CSV must have "name" and "lad_code" headers, got: ${header.join(",")}`,
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

function buildUrl(base, serviceId, row) {
  const fileName = `${row.ladCode}-${cleanCouncilName(row.name)}.html`;
  return `https://${base}/${serviceId}/${fileName}`;
}

const NEGATIVE_CHECK = { name: "foo", ladCode: "123456789" };

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

function loadServiceRows(args) {
  const services = discoverServices(args.servicesDir);
  const out = [];
  for (const svc of services) {
    const csvPath = path.isAbsolute(svc.csv)
      ? svc.csv
      : path.join(args.projectRoot, svc.csv);
    let contents;
    try {
      contents = fs.readFileSync(csvPath, "utf8");
    } catch (err) {
      throw new Error(
        `Could not read onboarding CSV for service "${svc.serviceId}" at ${csvPath}: ${err.message}`,
      );
    }
    const rows = parseCsv(contents);
    if (rows.length === 0) {
      throw new Error(
        `No rows found in onboarding CSV for service "${svc.serviceId}" (${csvPath})`,
      );
    }
    out.push({ serviceId: svc.serviceId, rows });
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const services = loadServiceRows(args);

  const urls = [];
  for (const svc of services) {
    for (const row of svc.rows) {
      urls.push({
        serviceId: svc.serviceId,
        row,
        url: buildUrl(args.base, svc.serviceId, row),
      });
    }
  }

  const serviceSummary = services
    .map((s) => `${s.serviceId}=${s.rows.length}`)
    .join(", ");
  console.log(
    `Checking ${urls.length} page URLs across ${services.length} service(s) ` +
      `against ${args.base} ` +
      `(concurrency=${args.concurrency}, retries=${args.retries})\n` +
      `  services: ${serviceSummary}\n`,
  );

  const results = await runPool(urls, args.concurrency, async (item) => {
    const result = await checkUrl(item.url, {
      retries: args.retries,
      retryDelayMs: args.retryDelayMs,
      timeoutMs: args.timeoutMs,
    });
    return {
      serviceId: item.serviceId,
      name: item.row.name,
      ladCode: item.row.ladCode,
      ...result,
    };
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
  console.log(`\n${passed}/${results.length} page URLs returned 200.`);

  // Per-service metrics: total URLs checked and how many returned 200.
  console.log("\nPer-service results:");
  const serviceOrder = services.map((s) => s.serviceId);
  const metricsByService = new Map(
    serviceOrder.map((id) => [id, { total: 0, passed: 0 }]),
  );
  for (const r of results) {
    const m = metricsByService.get(r.serviceId);
    m.total += 1;
    if (r.ok) m.passed += 1;
  }
  for (const serviceId of serviceOrder) {
    const m = metricsByService.get(serviceId);
    console.log(`  ${serviceId}: ${m.passed}/${m.total} URLs returned 200`);
  }

  // One negative check per service: a non-existent page must never be 200.
  const negativeResults = [];
  for (const svc of services) {
    const negativeUrl = buildUrl(args.base, svc.serviceId, NEGATIVE_CHECK);
    const negativeResult = await requestOnce(negativeUrl, args.timeoutMs);
    const negativeOk = negativeResult.status !== 200;
    console.log(
      `Negative check [${svc.serviceId}] ` +
        `${negativeUrl} -> ${negativeResult.status} ` +
        `(expected not 200) ${negativeOk ? "PASS" : "FAIL"}`,
    );
    negativeResults.push({ serviceId: svc.serviceId, negativeUrl, negativeOk });
  }

  const hasFailures = failures.length > 0;
  const negativeFailures = negativeResults.filter((n) => !n.negativeOk);

  if (hasFailures) {
    console.error(`\n${failures.length} page URL(s) failed:`);
    for (const f of failures) {
      const detail = f.error ? ` (${f.error})` : "";
      console.error(
        `  - [${f.serviceId}] ${f.name} [${f.ladCode}] -> ${f.status}${detail}`,
      );
    }
  }

  if (negativeFailures.length > 0) {
    console.error(
      `\n${negativeFailures.length} negative check(s) failed (a non-existent ` +
        `page returned 200, so the smoke test can no longer prove it detects ` +
        `broken pages):`,
    );
    for (const n of negativeFailures) {
      console.error(`  - [${n.serviceId}] ${n.negativeUrl} returned 200`);
    }
  }

  if (hasFailures || negativeFailures.length > 0) {
    process.exit(1);
  }
  console.log("\nAll page URLs are up and every negative check passed.");
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.stack || err.message}`);
  process.exit(1);
});
