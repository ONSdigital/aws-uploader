#!/usr/bin/env node
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

// Must match modules/render_service / services.tf: replace(replace(value,
// "/[^A-Za-z0-9-_ ]/", ""), " ", "-").
function cleanValue(value) {
  return String(value)
    .replace(/[^A-Za-z0-9\-_ ]/g, "")
    .replace(/ /g, "-");
}

// Build the page filename body from a page_filename_template and a row map,
// mirroring services.tf exactly: tokenise on "{column}" and substitute each
// column's cleaned value, keeping template literals verbatim. An unknown
// {placeholder} (a column not present in the row) is left as-is, surfacing the
// config mistake in the URL rather than silently vanishing.
function buildFilenameBody(template, row) {
  // Split keeps the captured column names at the odd indices.
  const parts = template.split(/\{([A-Za-z0-9_]+)\}/);
  return parts
    .map((part, i) =>
      i % 2 === 1
        ? Object.prototype.hasOwnProperty.call(row, part)
          ? cleanValue(row[part])
          : `{${part}}`
        : part,
    )
    .join("");
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
    throw new Error(
      `Could not read services directory ${servicesDir}: ${err.message}`,
    );
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
    const filenameTemplate =
      parseYamlScalar(yamlContents, "page_filename_template") ||
      "{lad_code}-{name}";
    // A service-scope service renders a single shared page at the bucket root
    // (/<service_id>.html) and has no onboarding CSV, so it is handled
    // separately from the per-user services below.
    const pageScope = parseYamlScalar(yamlContents, "page_scope") || "per_user";
    services.push({ serviceId, csv, filenameTemplate, pageScope });
  }
  if (services.length === 0) {
    throw new Error(
      `No <service>/service.yaml files found under ${servicesDir}`,
    );
  }
  return services;
}

// Parse the onboarding CSV into a list of row maps (column -> value), keyed by
// the header names. No columns are required here: which columns a service needs
// is determined by its page_filename_template, so a one-, two-, or many-column
// CSV all parse the same way. A row is skipped only if every cell is empty.
function parseCsv(contents) {
  const lines = contents
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const row = {};
    header.forEach((h, idx) => {
      row[h] = cols[idx] !== undefined ? cols[idx] : "";
    });
    if (Object.values(row).every((v) => v === "")) continue;
    rows.push(row);
  }
  return rows;
}

function buildUrl(base, serviceId, filenameTemplate, row, pageScope) {
  // A service-scope service is a single page at the bucket root
  // (/<service_id>.html), with no per-user filename body.
  if (pageScope === "service") {
    return `https://${base}/${serviceId}.html`;
  }
  const fileName = `${buildFilenameBody(filenameTemplate, row)}.html`;
  return `https://${base}/${serviceId}/${fileName}`;
}

// A row that cannot correspond to any real onboarded user, for the negative
// check. Covers the columns the default and example templates reference so the
// synthesised URL is well-formed whatever the service's template is; unknown
// {placeholders} are left literal by buildFilenameBody, which is still a URL
// that must not exist.
const NEGATIVE_CHECK = {
  name: "foo",
  lad_code: "123456789",
  id: "no-such-id-123456789",
  region: "no-such-region",
};

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
    // A service-scope service has no onboarding CSV; it is a single root page.
    // Emit one synthetic row so the rest of the pipeline (URL building, result
    // reporting) is unchanged in shape.
    if (svc.pageScope === "service") {
      out.push({
        serviceId: svc.serviceId,
        filenameTemplate: svc.filenameTemplate,
        pageScope: svc.pageScope,
        rows: [{}],
      });
      continue;
    }

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
    out.push({
      serviceId: svc.serviceId,
      filenameTemplate: svc.filenameTemplate,
      pageScope: svc.pageScope,
      rows,
    });
  }
  return out;
}

// A short, human-readable label for a row in logs. Prefers a "name" column,
// then an "id" column, otherwise joins the row's values.
function rowLabel(row) {
  if (row.name) return row.name;
  if (row.id) return row.id;
  return (
    Object.values(row)
      .filter((v) => v !== "")
      .join(" / ") || "(row)"
  );
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
        url: buildUrl(
          args.base,
          svc.serviceId,
          svc.filenameTemplate,
          row,
          svc.pageScope,
        ),
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
      label: rowLabel(item.row),
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
    // For a service-scope service the real page is /<service_id>.html, so the
    // negative probe must target a path that genuinely should not exist: a
    // bogus per-user page under the service prefix.
    const negativeUrl =
      svc.pageScope === "service"
        ? `https://${args.base}/${svc.serviceId}/no-such-page-123456789.html`
        : buildUrl(
            args.base,
            svc.serviceId,
            svc.filenameTemplate,
            NEGATIVE_CHECK,
            svc.pageScope,
          );
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
      console.error(`  - [${f.serviceId}] ${f.label} -> ${f.status}${detail}`);
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
