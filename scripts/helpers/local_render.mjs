#!/usr/bin/env node
/**
 * Local preview renderer for the generic-uploader pages.
 *
 * Mirrors the Terraform logic in modules/render_service/main.tf so you can
 * see what a rendered page looks like WITHOUT deploying to AWS.
 *
 * It reproduces:
 *   - box_fragments  : one ONS Design System field block per upload box,
 *                      with {code} replaced by the LAD code
 *   - upload_boxes_html = box_fragments joined with "\n"
 *   - templatefile() : ${page_title}/${heading}/${submit_text}/
 *                      ${uploading_banner}/${upload_boxes_html} substitution
 *
 * Service configs are read straight from the services/ folder (one YAML file
 * per service — the same files Terraform's local.services loads), so there is
 * nothing to keep in sync. Pass --service <id> to pick one.
 *
 * Usage:
 *   node scripts/helpers/local_render.mjs --list
 *   node scripts/helpers/local_render.mjs --service electoral-register
 *   node scripts/helpers/local_render.mjs --service james-mega-service --council "Test Council" --lad 12345678
 *   node scripts/helpers/local_render.mjs --config my-service.json   # override: render from a JSON file
 */

import { readFileSync, writeFileSync, watch, readdirSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
// repo root is two levels up from scripts/helpers/
const REPO_ROOT = resolve(__dirname, "..", "..");
const TEMPLATE_PATH = join(REPO_ROOT, "scripts", "template", "generic-template.html");
const SERVICES_DIR = join(REPO_ROOT, "services");

// ---------------------------------------------------------------------------
// services/ loader
//
// Service definitions live as one folder per service under services/
// (services/<service_id>/service.yaml) — the same files Terraform's
// local.services loads via fileset + yamldecode in services.tf. We just
// yamldecode each service.yaml, so the renderer stays byte-for-byte in sync
// with Terraform with no HCL parsing. Pass --config to render from a
// standalone JSON/YAML file instead.
// ---------------------------------------------------------------------------

/** Load all services from the services/ folder into { id: serviceConfig }. */
function loadServices() {
  const ids = readdirSync(SERVICES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(SERVICES_DIR, d.name, "service.yaml")))
    .map((d) => d.name);
  if (ids.length === 0) {
    throw new Error(`No <service>/service.yaml files found in ${SERVICES_DIR}`);
  }
  const services = {};
  for (const id of ids) {
    const svc = parseYaml(readFileSync(join(SERVICES_DIR, id, "service.yaml"), "utf8")) || {};
    // Normalise the fields the renderer uses, defaulting the optional ones.
    services[id] = {
      service_id: svc.service_id || id,
      wording: svc.wording || {},
      boxes: (svc.boxes || []).map((b) => ({
        id: b.id,
        label: b.label,
        description: b.description,
        required: b.required ?? false,
        accepted_types: b.accepted_types || [],
        accepted_extensions: b.accepted_extensions || [],
      })),
    };
  }
  return services;
}

// ---------------------------------------------------------------------------
// Arg parsing (minimal)
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {
    council: "Example Council",
    lad: "12345678",
    out: null,
    config: null,
    service: null,
    list: false,
    watch: false,
    port: 3000,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--council") args.council = argv[++i];
    else if (a === "--lad") args.lad = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--config") args.config = argv[++i];
    else if (a === "--service") args.service = argv[++i];
    else if (a === "--list") args.list = true;
    else if (a === "--watch" || a === "-w") args.watch = true;
    else if (a === "--port") args.port = parseInt(argv[++i], 10);
    else if (a === "--help" || a === "-h") {
      console.log(
        [
          "Usage: node scripts/helpers/local_render.mjs [options]",
          "",
          "  --service ID      Render a service defined in services/<id>.yaml (default: first service)",
          "  --list            List the service ids defined in services/ and exit",
          "  --council NAME    Council name in the page heading (default: Example Council)",
          "  --lad CODE        LAD code injected into descriptions (default: 12345678)",
          "  --config FILE     Render from a JSON config file instead of services/",
          "  --out FILE        Output HTML path (default: scripts/preview-<id>-<lad>-<council>.html)",
          "  --watch, -w       Watch services/ and the template for changes; serve on localhost",
          "  --port PORT       Port for the watch dev server (default: 3000)",
        ].join("\n"),
      );
      process.exit(0);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Render logic (faithful to modules/render_service/main.tf)
// ---------------------------------------------------------------------------
function buildBoxFragment(box, ladCode) {
  const optionalSuffix = box.required ? "" : " (optional)";
  const description = String(box.description).replaceAll("{code}", ladCode);
  const accept = [...(box.accepted_extensions || []), ...(box.accepted_types || [])].join(",");
  // Indentation mirrors the Terraform heredoc output closely enough for preview.
  return `      <div class="ons-panel ons-u-mb-m" id="${box.id}-file-error">
        <p class="ons-panel__error" id="${box.id}-file-type-error" style="display: none">
          <strong id="${box.id}-file-error-text"></strong>
        </p>
        <div class="ons-field">
          <div class="ons-field">
            <label class="ons-label ons-label--with-description" for="${box.id}-input"
              aria-describedby="${box.id}-description">${box.label}${optionalSuffix}</label>
            <span id="${box.id}-description" class="ons-label__description ons-input--with-description">${description}</span>
            <input name="${box.id}" type="file" id="${box.id}-input" data-box-id="${box.id}"
              class="ons-input ons-input--text ons-input-type__input ons-input--upload"
              accept="${accept}"
              aria-describedby="${box.id}-description">
          </div>
        </div>
      </div>`;
}

function render(service, { council, lad }) {
  const wording = service.wording;
  const heading = `${wording.heading_prefix}${council}`;
  const uploadBoxesHtml = service.boxes.map((b) => buildBoxFragment(b, lad)).join("\n");

  const substitutions = {
    page_title: wording.page_title,
    heading,
    submit_text: wording.submit_text,
    uploading_banner: wording.uploading_banner,
    upload_boxes_html: uploadBoxesHtml,
  };

  let template = readFileSync(TEMPLATE_PATH, "utf8");
  // Terraform templatefile() uses ${name}; substitute each known token.
  for (const [name, value] of Object.entries(substitutions)) {
    template = template.replaceAll("${" + name + "}", value ?? "");
  }
  return template;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const args = parseArgs(process.argv);

let service;

if (args.config) {
  // Explicit JSON override.
  service = JSON.parse(readFileSync(resolve(process.cwd(), args.config), "utf8"));
} else {
  const services = loadServices();
  const ids = Object.keys(services);

  if (args.list) {
    console.log("Services defined in services/:");
    for (const id of ids) {
      const n = services[id].boxes.length;
      console.log(`  - ${id}  (${n} box${n === 1 ? "" : "es"})`);
    }
    process.exit(0);
  }

  if (ids.length === 0) {
    console.error("No services found in services/");
    process.exit(1);
  }

  const chosen = args.service || ids[0];
  if (!services[chosen]) {
    console.error(`Service "${chosen}" not found in services/.`);
    console.error(`Available: ${ids.join(", ")}`);
    process.exit(1);
  }
  service = services[chosen];
}

const cleanCouncil = args.council.replace(/[^A-Za-z0-9-_ ]/g, "").replace(/ /g, "-");
const defaultOut = join(REPO_ROOT, "scripts", `preview-${service.service_id}-${args.lad}-${cleanCouncil}.html`);
const outPath = args.out ? resolve(process.cwd(), args.out) : defaultOut;

// ---------------------------------------------------------------------------
// Auto-reload snippet injected into the page in --watch mode.
// A tiny script long-polls /__reload; the server holds the request until a
// file change triggers a re-render, then responds with 200 and the browser
// reloads. No dependencies, no websocket, no npm packages.
// ---------------------------------------------------------------------------
const RELOAD_SNIPPET = `
<script>
(function() {
  function poll() {
    fetch("/__reload").then(function() { location.reload(); }).catch(function() {
      setTimeout(poll, 1000);
    });
  }
  poll();
})();
</script>`;

function doRender() {
  // Re-load the service YAML each time in case it changed.
  if (!args.config) {
    const svcs = loadServices();
    service = svcs[args.service || Object.keys(svcs)[0]];
  }
  return render(service, { council: args.council, lad: args.lad });
}

if (!args.watch) {
  // --- One-shot mode (original behaviour) ---
  const html = doRender();
  writeFileSync(outPath, html, "utf8");
  console.log(`Rendered ${service.service_id} page for "${args.council}" (LAD ${args.lad})`);
  console.log(`  boxes: ${service.boxes.length}`);
  console.log(`Output: ${outPath}`);
  console.log(`Open it with:  open "${outPath}"`);
} else {
  // --- Watch mode: serve on localhost with auto-reload ---
  let currentHtml = doRender() + RELOAD_SNIPPET;
  let pendingClients = []; // long-poll response objects waiting for a change

  function rerender() {
    try {
      currentHtml = doRender() + RELOAD_SNIPPET;
      console.log(`[${new Date().toLocaleTimeString()}] Re-rendered ${service.service_id}`);
      // Release all waiting long-poll clients so the browser reloads.
      for (const res of pendingClients) {
        res.writeHead(200);
        res.end("reload");
      }
      pendingClients = [];
    } catch (e) {
      console.error("Re-render failed:", e.message);
    }
  }

  // Watch the services/ folder (recursively, to catch per-service
  // subfolders) and the template for changes.
  watch(SERVICES_DIR, { persistent: true, recursive: true }, (eventType) => {
    if (eventType === "change" || eventType === "rename") rerender();
  });
  const filesToWatch = [TEMPLATE_PATH];
  if (args.config) filesToWatch.push(resolve(process.cwd(), args.config));
  for (const f of filesToWatch) {
    watch(f, { persistent: true }, (eventType) => {
      if (eventType === "change" || eventType === "rename") rerender();
    });
  }

  // Minimal HTTP server.
  const server = createServer((req, res) => {
    if (req.url === "/__reload") {
      // Hold the connection open until a file change triggers rerender().
      req.on("close", () => {
        pendingClients = pendingClients.filter((r) => r !== res);
      });
      pendingClients.push(res);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(currentHtml);
  });

  server.listen(args.port, () => {
    console.log(`Watching services/ + template for changes...`);
    console.log(`Serving ${service.service_id} at http://localhost:${args.port}`);
    console.log(`Edit the service YAML or the template and the browser will reload automatically.`);
    console.log(`Press Ctrl+C to stop.`);
  });
}