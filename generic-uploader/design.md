# Design — Generic Configurable Uploader

## Overview

This design converts the single-purpose Council Tax uploader into a **config-driven, multi-service
platform**. A "service" (e.g. Council Tax, Electoral Register) is fully described by one
configuration object: its URL/S3 path prefix, page wording, and an ordered list of 1..N upload
boxes with per-box validation rules. The existing Council Tax behaviour becomes the first service
config; Electoral Register becomes the second.

Routing uses **Option A (path-based)**: all services share the existing `uploader.<domain>`
CloudFront distribution and are separated by path prefix (`/council-tax/...`,
`/electoral-register/...`). No new DNS, certificate, or CloudFront alias is required.

### Assumptions baked into this design (adjustable in config)

- **Onboarding:** one CSV per service (`councils.csv`, `electoral-register.csv`), columns
  `name,lad_code`. The same council may appear in both.
- **File types are per-box lists:** each box declares `accepted_types` (MIME) and
  `accepted_extensions` as lists, so a box may accept one format (e.g. `.csv`), another
  (e.g. `.txt`), or several (e.g. `.csv` AND `.txt`). The Electoral Register default is CSV only.
- **Number of upload boxes is fully configurable:** `boxes` is an ordered list of length 1..N, so a
  service can present 1, 2, 3 or more submissions. This is the primary generalisation of the design.
- **Electoral Register filename convention (placeholder):**
  compulsory `ER_EXTRACT_<lad_code>_<yyyymmdd>.csv`, optional `ER_MANI_<lad_code>_<yyyymmdd>.csv`.
  Prefixes live in config and can be changed without code edits.
- **Cross-file date-match rule:** applied only when all referenced files are present (so an
  optional-but-omitted file never triggers a mismatch).

## Current vs target architecture

### Current (single service)
```
councils.csv (name,lad_code)
      │  csvdecode + for_each (s3_host.tf)
      ▼
modules/render_council ── templatefile(council-tax-template.html, {council_name, lad_code})
      │
      ▼
S3 host bucket: council-tax/<lad>-<name>.html   ──(CloudFront)──▶ browser
                                                                   │ file_submission.js (fixed 2 files, CTAX regex)
                                                                   ▼
                                              API GW GET /pre-signed-url ──▶ PreSignedURL.mjs (fileOne/fileTwo, text/csv, council-tax/ prefix)
                                                                   ▼
                                              presigned PUT ──▶ S3 ingest: council-tax/<name>/<date>/<file>
```

### Target (multi service, config-driven)
```
services/*.json  (service config: id, wording, boxes[], patterns)
councils.csv, electoral-register.csv  (per-service onboarding)
      │  for each service: csvdecode + for_each users (s3_host.tf)
      ▼
modules/render_service ── templatefile(generic-template.html, { service_config_json, user_name, lad_code })
      │
      ▼
S3 host bucket: <service_id>/<lad>-<name>.html + <service_id>/config.js  ──(CloudFront)──▶ browser
                                                                                            │ file_submission.js (loops boxes[] from injected config)
                                                                                            ▼
                                              API GW GET /pre-signed-url?serviceId=..&files=[..] ──▶ PreSignedURL.mjs (reads service config, N files)
                                                                                            ▼
                                              presigned PUT(s) ──▶ S3 ingest: <service_id>/<name>/<date>/<file>
```

## Components and interfaces

### 1. Service configuration (single source of truth)

A service is defined once and consumed by Terraform (rendering), the client JS (validation/upload),
and the Lambda (validation/key layout). To avoid drift, the config is authored in **HCL/`.tf`
locals** (so Terraform can validate it) and serialised to JSON for the browser and Lambda.

Proposed location: `services/<service_id>.tf` contributing to a `local.services` map, plus the
onboarding CSV `<service_id>.csv` (or the existing `councils.csv` for council-tax).

#### Config schema (conceptual)

```jsonc
{
  "service_id": "electoral-register",      // URL + S3 prefix; [a-z0-9-]
  "onboarding_csv": "electoral-register.csv",
  "wording": {
    "page_title": "ONS Electoral Register Uploader",
    "heading_prefix": "Electoral Register - ",   // heading = prefix + <user name>
    "contact_email": "elections@ons.gov.uk",
    "uploading_banner": "Uploading. Do not refresh or close the page.",
    "submit_text": "Submit",
    "success_message": "..."                 // optional overrides
  },
  "boxes": [
    {
      "id": "extract",                       // stable; used in DOM ids and request keys
      "label": "Upload the Electoral Register file",
      "description": "File must be named 'ER_EXTRACT_{code}_yyyymmdd' ...",
      "required": true,
      // Accepted file types are LISTS so a box can allow one or several formats,
      // e.g. CSV only, TXT only, or CSV AND TXT. Both lists are config-driven.
      "accepted_types": ["text/csv"],              // allowed MIME types
      "accepted_extensions": [".csv"],             // allowed extensions (lower-cased on compare)
      "filename_prefix": "ER_EXTRACT_",       // full pattern: ^<prefix><code>_\d{8}\.(csv)$
      "code_source": "url_lad_code"           // where {code} comes from (page URL)
    },
    {
      "id": "mani",
      "label": "Upload the Marked Register file (optional)",
      "description": "File must be named 'ER_MANI_{code}_yyyymmdd' ...",
      "required": false,
      "accepted_types": ["text/csv", "text/plain"],   // e.g. CSV AND TXT
      "accepted_extensions": [".csv", ".txt"],
      "filename_prefix": "ER_MANI_",
      "code_source": "url_lad_code"
    }
  ],
  "cross_file_rules": [
    { "type": "matching_date_suffix", "boxes": ["extract", "mani"] }
  ],
  "monitoring": { "fixed_label_box_id": "extract" }  // preserves uptime-check label
}
```

The Council Tax config is the same shape:
`service_id: "council-tax"`, boxes `extract` (prefix `CTAX_EXTRACT_`, required) and
`mani` (prefix `CTAX_MANI_`, required), `heading_prefix: "Council Tax - "`,
`contact_email: "council.tax@ons.gov.uk"`, and the `matching_date_suffix` cross-file rule — so
the current site is reproduced exactly.

#### Validation of config (Requirement 1.6)

Terraform validates each service at plan time via `local` assertions / `validation` blocks:
- `service_id` matches `^[a-z0-9-]+$` and is unique;
- `boxes` is a non-empty list of length 1..N; each box has unique `id`, non-empty `label`,
  boolean `required`, and at least one entry across `accepted_types`/`accepted_extensions`;
- `cross_file_rules[*].boxes` reference existing box ids.
Failures surface as `terraform plan` errors.

### 2. Rendering module — `modules/render_service` (generalises `render_council`)

Inputs: `service_config` (object), `user_name`, `lad_code`, `bucket-id`, `template_path`.

Behaviour:
- `templatefile(generic-template.html, { heading, page_title, submit_text, boxes_json, lad_code, ... })`.
- `heading = "${service_config.wording.heading_prefix}${user_name}"`.
- Reuses the existing clean-name derivation (strip special chars, spaces→dashes) so Council Tax
  URLs are identical.
- Writes to `s3://host/<service_id>/<lad_code>-<clean_name>.html`.

The template loops over `boxes` to emit one `ons-field`/file input per box (replacing the two
hardcoded EXTRACT/MANI blocks), preserving ONS Design System markup, error panels, header/footer,
and accessibility attributes. Each box's hint substitutes `{code}` with `lad_code`.

> Note: Terraform `templatefile` cannot run arbitrary loops over complex objects easily. Two
> viable approaches: (a) build the per-box HTML fragments in a `local` using a `for` expression and
> inject the concatenated string into a single `${upload_boxes_html}` placeholder; (b) render boxes
> client-side from an injected `config.js`. **Chosen: (a) for the static markup + (b) for behaviour
> wiring** — the boxes are present in server-rendered HTML (progressive enhancement / no-JS
> accessibility and uptime checks still see real inputs), while `file_submission.js` reads the same
> config for validation/upload. The config is emitted once per service as
> `<service_id>/config.js` (`window.UPLOADER_CONFIG = {...}`).

### 3. Terraform wiring — `s3_host.tf`

- Replace the single `local.councils-csv` with a `local.services` map and, per service, decode its
  onboarding CSV: `csvdecode(file(service.onboarding_csv))`.
- Replace the single `module "render_council"` with `module "render_service"` iterated over the
  flattened set of `(service_id, user)` pairs.
- Per service, publish shared assets under the service prefix: `index`/landing (optional),
  `success.html`, `file_submission.js` (api_url injected as today), `result_message.js`, and the
  generated `config.js`.
- The existing single generic `file_submission.js` is reused for all services (it reads
  `window.UPLOADER_CONFIG`). Only `api_url` is injected via `templatefile` as today.

### 4. Client script — `scripts/file_submission.js` (generalised)

- Read `window.UPLOADER_CONFIG` (service config) on load.
- Build the list of boxes from `config.boxes`; for each box resolve its DOM input by `id`.
- Validation loop:
  - required + empty → add error for that box, block submit;
  - optional + empty → skip;
  - present → check the file's extension is in `box.accepted_extensions` AND/OR its MIME type is in
    `box.accepted_types` (a file passes if it matches an allowed extension or type), then check the
    filename against `^<filename_prefix><code>_\d{8}\.(ext1|ext2|...)$` (case-insensitive, where the
    extension alternation is built from `accepted_extensions`), with `<code>` parsed from the page
    URL exactly as today (`lastPart.split("-")[0]`).
  - The file input's `accept` attribute is set from `accepted_extensions`/`accepted_types` so the OS
    file picker filters accordingly.
- Cross-file rules: for each configured rule (e.g. `matching_date_suffix`) compare only the boxes
  that have files present.
- Request: `GET ${api_url}pre-signed-url?serviceId=<id>&councilName=<name>&files=<url-encoded JSON
  array of {boxId,name,type,size}>`. (Chosen over many positional params so N files are supported;
  the Lambda parses the array.)
- Upload: `Promise.all` over the returned per-box upload descriptors, reusing the existing single
  PUT and multipart logic unchanged.
- Error strings and contact email come from `config.wording`.

Backwards-compatibility note: the Council Tax config reproduces the current two-box flow and the
same error text, so behaviour is unchanged for that service.

### 5. Lambda — `src/PreSignedURL.mjs` (generalised)

- Load service configs (bundled JSON generated at build/deploy, or an env var/SSM) keyed by
  `service_id`.
- Parse `serviceId` and the `files` array from the query string.
- For each file: validate size≠0, that its type/extension is permitted by the box's
  `accepted_types`/`accepted_extensions` lists, and filename against the box's pattern (regex built
  from `filename_prefix` + code + date + an extension alternation from `accepted_extensions`),
  replacing the current fixed-offset slicing (`.slice(13,22)` etc.) and the hardcoded
  `!== "text/csv"` check.
- Apply configured `cross_file_rules` across the provided files.
- Build S3 key `<service_id>/<councilName>/<formattedDate>/<fileName>` (replacing the hardcoded
  `council-tax/` prefix in `createUploadData`).
- Return `{ message, uploads: { <boxId>: <uploadDescriptor> } }`. For single vs multipart the
  descriptor shape is unchanged from today.
- Response messages remain structured so the client maps them to the right per-box error.

> The code (`LADCode = ...slice(13,22)`) and match checks are replaced by regex capture groups from
> the configured pattern so they work for any prefix length.

### 6. Infrastructure (unchanged by Option A)

- `cloudfront.tf`: add `/<service_id>/*` to the invalidation set; CSP already permits the API
  endpoints and ingest S3 origin, so no CSP change is needed for same-origin paths.
- `s3_upload.tf` lifecycle, `s3_logging.tf`, `sqs.tf`, `athena.tf`, `cloudwatch.tf`, `alerts.tf`
  apply to all prefixes automatically.
- `certificate.tf`, `route_53.tf`, CloudFront aliases: no change.

## Data model

### Service (Terraform local → JSON)
`service_id, onboarding_csv, wording{...}, boxes[], cross_file_rules[], monitoring{}` as above.

### Onboarding CSV (per service)
`name, lad_code` — unchanged columns; keeps special rows (Health Status, Performance Test, Test)
for the Council Tax service.

### S3 key layout
- Host (pages/assets): `<service_id>/<lad>-<name>.html`, `<service_id>/config.js`,
  `<service_id>/file_submission.js`, `<service_id>/success.html`.
- Ingest (uploads): `<service_id>/<council_name>/<yyyymmddHHMMSS>/<filename>`.

## Sequence — upload (generic)

```
Browser                         CloudFront        API GW / Lambda                 S3 ingest
  │ load /<svc>/<lad>-<name>.html + config.js        │                               │
  │ user selects files, Submit                       │                               │
  │ validate boxes[] per UPLOADER_CONFIG             │                               │
  │ GET /pre-signed-url?serviceId&councilName&files ─┼──▶ validate size/type/pattern │
  │                                                  │     + cross-file rules        │
  │ ◀──────────── { uploads:{boxId:descriptor} } ────┤                               │
  │ for each provided file: PUT (or multipart) ──────┼───────────────────────────────▶ <svc>/<name>/<date>/<file>
  │ all complete → location = <svc>/success.html     │                               │
```

## Error handling

- **Config errors:** fail `terraform plan` (schema assertions) — never deploy a broken page.
- **Client validation:** per-box inline errors + summary list (existing ONS error-panel pattern),
  text sourced from config.
- **Lambda validation:** structured `message` values (`"<boxId> is not .csv"`, `"File is empty"`,
  `"File names do not match"`) mapped client-side to per-box styling; contact email from config on
  unexpected upload failure.
- **Backwards compat:** Council Tax messages/" there is 1 problem" summaries unchanged.

## Testing strategy

- **Cucumber behaviour tests** (existing `features/`): extend with scenarios for (a) a single-box
  required-only service, (b) optional box omitted succeeds, (c) optional box provided is validated,
  (d) Council Tax regression (two required boxes, date-match). Reuse existing `test_files/` naming
  and add `ER_*` fixtures.
- **Lambda unit tests**: config-driven validation for N files, pattern/type checks, key layout per
  service, cross-file rules.
- **Terraform validation**: `terraform validate` + `plan` on example configs; assert invalid config
  fails. `tflint`/`checkov`/`trivy` as in existing CI.
- **Manual/CI**: confirm Council Tax URLs and rendered markup are byte-stable where required
  (preserve the uptime-check fixed label).

## Migration / rollout

1. Introduce config model + generic template + generalised JS/Lambda while keeping Council Tax
   output identical (feature-parity refactor; no URL/behaviour change).
2. Express Council Tax as `services/council-tax.tf` + existing `councils.csv`; verify parity.
3. Add `services/electoral-register.tf` + `electoral-register.csv` (reuse council list).
4. Apply; CloudFront invalidation covers `/electoral-register/*`.
5. Validate ER flows (compulsory-only; both files) and Council Tax regression.

## Open items to confirm later (non-blocking)

- Real Electoral Register filename convention + whether non-CSV types are ever needed.
- Whether ER needs its own landing page or just the per-council pages.
- Whether to source Lambda service configs from a bundled JSON vs SSM parameter.
