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
 * Service configs are read straight from services.tf (single source of truth),
 * so there is nothing to keep in sync. Pass --service <id> to pick one.
 *
 * Usage:
 *   node scripts/helpers/local_render.mjs --list
 *   node scripts/helpers/local_render.mjs --service electoral-register
 *   node scripts/helpers/local_render.mjs --service james-mega-service --council "Test Council" --lad 12345678
 *   node scripts/helpers/local_render.mjs --config my-service.json   # override: render from a JSON file
 */

import { readFileSync, writeFileSync, watch } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// repo root is two levels up from scripts/helpers/
const REPO_ROOT = resolve(__dirname, "..", "..");
const TEMPLATE_PATH = join(REPO_ROOT, "scripts", "template", "generic-template.html");
const SERVICES_TF = join(REPO_ROOT, "services.tf");

// ---------------------------------------------------------------------------
// services.tf parser
//
// services.tf is HCL, not JSON. Rather than take a Terraform dependency we
// parse the regular structure of the `local.services` map directly. This
// handles the fields the renderer needs: service_id, wording.*, and each
// box's id/label/description/required/accepted_types/accepted_extensions.
// It is intentionally narrow — if services.tf grows a radically different
// shape, prefer `terraform` + `-json` output or pass --config.
// ---------------------------------------------------------------------------

/** Extract the body between the matching braces that follow `startIndex`. */
function extractBraceBlock(text, startIndex) {
  const open = text.indexOf("{", startIndex);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { body: text.slice(open + 1, i), end: i };
    }
  }
  return null;
}

/** Parse a `key = "value"` string assignment out of an HCL block body. */
function parseStringField(body, key) {
  const m = body.match(new RegExp(`${key}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? m[1].replace(/\\"/g, '"') : undefined;
}

/** Parse a `key = true|false` boolean assignment. */
function parseBoolField(body, key) {
  const m = body.match(new RegExp(`${key}\\s*=\\s*(true|false)`));
  return m ? m[1] === "true" : undefined;
}

/** Parse a `key = ["a", "b"]` string-list assignment. */
function parseStringListField(body, key) {
  const m = body.match(new RegExp(`${key}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (!m) return [];
  const inner = m[1].trim();
  if (!inner) return [];
  return [...inner.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1].replace(/\\"/g, '"'));
}

/** Parse the wording { ... } sub-block. */
function parseWording(serviceBody) {
  const idx = serviceBody.search(/\bwording\s*=/);
  if (idx === -1) return {};
  const blk = extractBraceBlock(serviceBody, idx);
  if (!blk) return {};
  const b = blk.body;
  return {
    page_title: parseStringField(b, "page_title"),
    heading_prefix: parseStringField(b, "heading_prefix"),
    contact_email: parseStringField(b, "contact_email"),
    uploading_banner: parseStringField(b, "uploading_banner"),
    submit_text: parseStringField(b, "submit_text"),
  };
}

/** Parse the boxes = [ { ... }, { ... } ] list. */
function parseBoxes(serviceBody) {
  const idx = serviceBody.search(/\bboxes\s*=\s*\[/);
  if (idx === -1) return [];
  // Find the matching ] for the boxes list.
  const open = serviceBody.indexOf("[", idx);
  let depth = 0;
  let end = -1;
  for (let i = open; i < serviceBody.length; i++) {
    const c = serviceBody[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return [];
  const listBody = serviceBody.slice(open + 1, end);

  // Walk each top-level { ... } object inside the list.
  const boxes = [];
  let i = 0;
  while (i < listBody.length) {
    const braceStart = listBody.indexOf("{", i);
    if (braceStart === -1) break;
    const blk = extractBraceBlock(listBody, braceStart);
    if (!blk) break;
    const b = blk.body;
    boxes.push({
      id: parseStringField(b, "id"),
      label: parseStringField(b, "label"),
      description: parseStringField(b, "description"),
      required: parseBoolField(b, "required") ?? false,
      accepted_types: parseStringListField(b, "accepted_types"),
      accepted_extensions: parseStringListField(b, "accepted_extensions"),
    });
    i = blk.end + 1;
  }
  return boxes;
}

/** Parse all services from services.tf into { id: serviceConfig }. */
function parseServicesTf() {
  const text = readFileSync(SERVICES_TF, "utf8");
  // Narrow to the `services = { ... }` map body.
  const svcIdx = text.search(/\bservices\s*=\s*\{/);
  if (svcIdx === -1) throw new Error("Could not find `services = {` in services.tf");
  const svcBlock = extractBraceBlock(text, svcIdx);
  if (!svcBlock) throw new Error("Could not parse the services map in services.tf");
  const body = svcBlock.body;

  // Each entry looks like:  "service-id" = { ... }
  const services = {};
  const entryRe = /"([a-z0-9-]+)"\s*=\s*\{/g;
  let m;
  while ((m = entryRe.exec(body)) !== null) {
    const id = m[1];
    const blk = extractBraceBlock(body, m.index);
    if (!blk) continue;
    const serviceBody = blk.body;
    services[id] = {
      service_id: parseStringField(serviceBody, "service_id") || id,
      wording: parseWording(serviceBody),
      boxes: parseBoxes(serviceBody),
    };
    // Resume scanning after this entry so nested braces aren't re-matched.
    entryRe.lastIndex = blk.end;
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
          "  --service ID      Render a service defined in services.tf (default: first service)",
          "  --list            List the service ids defined in services.tf and exit",
          "  --council NAME    Council name in the page heading (default: Example Council)",
          "  --lad CODE        LAD code injected into descriptions (default: 12345678)",
          "  --config FILE     Render from a JSON config file instead of services.tf",
          "  --out FILE        Output HTML path (default: scripts/preview-<id>-<lad>-<council>.html)",
          "  --watch, -w       Watch services.tf and the template for changes; serve on localhost",
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
  const services = parseServicesTf();
  const ids = Object.keys(services);

  if (args.list) {
    console.log("Services defined in services.tf:");
    for (const id of ids) {
      const n = services[id].boxes.length;
      console.log(`  - ${id}  (${n} box${n === 1 ? "" : "es"})`);
    }
    process.exit(0);
  }

  if (ids.length === 0) {
    console.error("No services found in services.tf");
    process.exit(1);
  }

  const chosen = args.service || ids[0];
  if (!services[chosen]) {
    console.error(`Service "${chosen}" not found in services.tf.`);
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
  // Re-parse services.tf each time in case it changed.
  if (!args.config) {
    const svcs = parseServicesTf();
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

  // Watch services.tf and the template for changes.
  const filesToWatch = [SERVICES_TF, TEMPLATE_PATH];
  if (args.config) filesToWatch.push(resolve(process.cwd(), args.config));
  for (const f of filesToWatch) {
    watch(f, { persistent: true }, (eventType) => {
      if (eventType === "change") rerender();
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
    console.log(`Watching services.tf + template for changes...`);
    console.log(`Serving ${service.service_id} at http://localhost:${args.port}`);
    console.log(`Edit services.tf or the template and the browser will reload automatically.`);
    console.log(`Press Ctrl+C to stop.`);
  });
}