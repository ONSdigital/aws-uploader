# Services and onboarding

This document covers how to onboard users and add new services to the generic uploader. It lives
next to `services.tf` because that file is the source of truth for every service definition.

The uploader is driven by configuration. There are two distinct onboarding tasks:

1. **Onboard a user** to an existing service — add a row to that service's CSV.
2. **Add a new service** (a new uploader "version") — add a config entry and a CSV.

## How it fits together

| Concern | Where it lives |
| --- | --- |
| Service definitions (wording, boxes, validation, prefix) | `services.tf` → `local.services` |
| Users for a service | the service's onboarding CSV under `data/` (e.g. `data/councils.csv`, `data/electoral-register.csv`) |
| The HTML page template (shared by all services) | `scripts/template/generic-template.html` |
| Per-user page rendering | `modules/render_service` |
| Client-side validation/upload (shared) | `scripts/file_submission.js` (reads `window.UPLOADER_CONFIG`) |
| Backend validation + presigned URLs (shared) | `src/PreSignedURL.mjs` (reads the `SERVICES_CONFIG` env var) |

A single service config is the source of truth: Terraform renders each user's page from it, emits a
`<service_id>/config.js` the browser reads, and injects the same config into the Lambda. There is
nothing to edit in the HTML, JS, or Lambda to add a service or user.

---

## 1. Onboard a user to an existing service

Each service has its own onboarding CSV under the `data/` folder, with two columns:
`name,lad_code`. Add one row per user.

For **Council Tax**, use the helper tool (recommended — it imports from an Excel spreadsheet and
applies standardised naming, reducing manual edits, typos and formatting drift, and produces an
audit log):

```bash
cd scripts/helpers/onboard_councils
poetry install
poetry run python onboard_councils_from_xlsx.py /path/to/input
```

For detailed setup, input requirements, logging and troubleshooting, see
`scripts/helpers/onboard_councils/README.md`.

For **other services** (e.g. Electoral Register), add rows directly to that service's CSV, for
example `data/electoral-register.csv`:

```csv
name,lad_code
Adur,E07000223
Birmingham,E08000025
```

> The same `name,lad_code` may appear in more than one service's CSV. Each service renders its own
> independent page for that user under its own path.

Then apply Terraform (see the Terraform section in the top-level `README.md`). A new page is
published at `uploader.<domain>/<service_id>/<lad_code>-<clean-name>.html` and the relevant
CloudFront paths are invalidated automatically.

---

## 2. Add a new service

Adding a service is config-only. Follow these steps:

**a. Create the onboarding CSV** in the `data/` folder, named after the service, with
`name,lad_code`:

```text
data/<service-id>.csv
```

**b. Add the service to `services.tf`** inside `local.services`. Copy an existing block and adjust:

```hcl
"my-service" = {
  service_id     = "my-service"            # URL + S3 prefix; must match ^[a-z0-9-]+$ and be unique
  onboarding_csv = "data/my-service.csv"   # path relative to the repo root

  wording = {
    page_title       = "ONS-Uploader"
    heading_prefix   = "My Service - "     # page heading = prefix + user name
    contact_email    = "my-team@ons.gov.uk"
    uploading_banner = "Uploading. Do not refresh or close the page."
    submit_text      = "Submit"
  }

  # One entry per upload box. The count of boxes = the number of submissions (1, 2, 3, ...).
  boxes = [
    {
      id                  = "primary"       # stable id; used for DOM ids and the upload key
      label               = "Upload the primary file"
      description         = "File must be named 'MYS_PRIMARY_{code}_yyyymmdd...'"  # {code} -> user's LAD code
      required            = true
      accepted_types      = ["text/csv"]    # MIME list; may be empty if only extensions matter
      accepted_extensions = [".csv"]        # extension list; e.g. [".csv", ".txt"] to accept both
      filename_prefix     = "MYS_PRIMARY_"  # filename pattern = ^<prefix><code>_<8-digit date>.<ext>$
    },
    {
      id                  = "secondary"
      label               = "Upload the secondary file"
      description         = "File must be named 'MYS_SECONDARY_{code}_yyyymmdd...'"
      required            = false           # optional: validated only when a file is provided
      accepted_types      = ["text/csv", "text/plain"]
      accepted_extensions = [".csv", ".txt"]
      filename_prefix     = "MYS_SECONDARY_"
    },
  ]

  # Optional cross-file rules. "matching_date_suffix" requires the yyyymmdd parts to match
  # across the listed boxes (only enforced across boxes that actually have a file).
  cross_file_rules = [
    { type = "matching_date_suffix", boxes = ["primary", "secondary"] },
  ]
}
```

**c. Apply Terraform.** This renders a page per user, publishes `my-service/config.js`,
`my-service/file_submission.js`, `my-service/result_message.js`, `my-service/success.html`, injects
the config into the Lambda, and invalidates `/my-service/*` on CloudFront.

### Configuration reference

Every field a service accepts is listed below, grouped by block. "Required" means Terraform (or the
runtime) expects it; optional fields fall back to a sensible default when omitted.

#### Top-level fields

| Field | Required | Type | What it does |
| --- | --- | --- | --- |
| `service_id` | yes | string | The service's unique identifier. It becomes the **URL path prefix** (`/<service_id>/...`) and the **S3 key prefix** where that service's rendered pages and assets live. Must match `^[a-z0-9-]+$` (lowercase letters, digits, hyphens) and be unique across all services. Changing it after launch changes every user's URL, so treat it as permanent. |
| `onboarding_csv` | yes | string | Path (relative to the repo root, conventionally under `data/`) to this service's onboarding CSV. The CSV has two columns, `name,lad_code`: one row per organisation that should get a page. Terraform reads it with `csvdecode` and renders **one static page per row**. |

#### `wording` block (page text)

These control the user-facing copy on the rendered page. All are plain strings.

| Field | Required | What it does | Example |
| --- | --- | --- | --- |
| `wording.page_title` | yes | The HTML `<title>` (the browser tab text). | `"ONS-Uploader"` |
| `wording.heading_prefix` | yes | Prefix for the page's main `<h1>`. The final heading is `heading_prefix` + the user's `name` from the CSV, so each organisation sees its own name. Include any trailing space/separator you want (e.g. `"Electoral Register - "`). | `"Electoral Register - "` → `Electoral Register - Adur` |
| `wording.contact_email` | yes | Support address shown in error messages (the `{contact}` placeholder). Not emailed to automatically; it's display text. | `"elections@ons.gov.uk"` |
| `wording.uploading_banner` | yes | Text shown in the status banner while an upload is in progress. | `"Uploading. Do not refresh or close the page."` |
| `wording.submit_text` | yes | Label on the submit button. | `"Submit"` |
| `wording.errors` | no | Optional map of error-message overrides. Any key you omit uses the built-in default. See "Customising error messages" below. | — |

#### `boxes[]` block (upload fields)

An **ordered list of upload boxes**. The number of boxes is the number of files a user submits in one
go — one box = one file picker on the page. Order here is the order they appear on the page.

| Field | Required | Type | What it does |
| --- | --- | --- | --- |
| `boxes[].id` | yes | string | Stable identifier for the box. Used to build DOM element ids on the page and as the key for the upload. Must be unique within the service. Keep it short and stable; changing it is effectively a new box. |
| `boxes[].label` | yes | string | The visible field label (shown next to the file picker). A leading `"Upload "` is stripped when the label is interpolated into error messages via `{label}`. |
| `boxes[].description` | yes | string | The hint text under the label, usually explaining the required filename. The token `{code}` is replaced at render time with the user's LAD code from the CSV, so each organisation sees its own code in the example. |
| `boxes[].required` | yes | bool | `true` means the box must have a file or submission is blocked. `false` makes it optional — it's only validated when the user actually provides a file. |
| `boxes[].accepted_types` | yes* | list(string) | Allowed MIME types (e.g. `["text/csv"]`). May be empty if you only want to restrict by extension — but each box must have at least one of `accepted_types` or `accepted_extensions`. |
| `boxes[].accepted_extensions` | yes* | list(string) | Allowed file extensions, with the dot (e.g. `[".csv", ".txt"]`). A file is accepted if it matches **any** listed type **or** extension, so `[".csv", ".txt"]` allows CSV and TXT. |
| `boxes[].filename_prefix` | yes | string | The fixed prefix the uploaded filename must start with. It builds the validation regex `^<prefix><code>_<8-digit date>.<ext>$` — i.e. prefix, then the user's LAD code, an underscore, an 8-digit `yyyymmdd` date, and an allowed extension. |

\* Not individually required, but each box must have at least one accepted type or extension (enforced at plan time).

#### Common MIME types for `accepted_types`

`accepted_types` holds **MIME types** — the standard `type/subtype` label the browser attaches to a
file when a user selects it (exposed as `file.type` in the client). A file is accepted if its MIME
type matches an entry here **or** its extension matches `accepted_extensions`, so for everyday CSV
uploads you can rely on the extension and keep `accepted_types = ["text/csv"]` for completeness.

The table below lists the MIME types most likely to be useful for uploader services, with the
extension(s) you would normally pair them with. Use the exact MIME string (not just `csv`), and
remember browsers can report an empty string or a generic type for some files — which is why
`accepted_extensions` is the more reliable check and both lists are OR'd together.

| File kind | MIME type (`accepted_types`) | Typical extension(s) (`accepted_extensions`) |
| --- | --- | --- |
| CSV | `text/csv` | `.csv` |
| Plain text | `text/plain` | `.txt` |
| Tab-separated values | `text/tab-separated-values` | `.tsv` |
| JSON | `application/json` | `.json` |
| XML | `application/xml` (or `text/xml`) | `.xml` |
| Excel (modern, .xlsx) | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` |
| Excel (legacy, .xls) | `application/vnd.ms-excel` | `.xls` |
| PDF | `application/pdf` | `.pdf` |
| ZIP archive | `application/zip` | `.zip` |
| Gzip archive | `application/gzip` | `.gz` |

> Notes:
> - Match MIME types and extensions as a pair — e.g. a box that accepts CSV **or** TXT uses
>   `accepted_types = ["text/csv", "text/plain"]` and `accepted_extensions = [".csv", ".txt"]`.
> - Older browsers sometimes report `.csv` files as `application/vnd.ms-excel`; keeping `.csv` in
>   `accepted_extensions` ensures those still pass.
> - This is a convenience list, not an allow-list enforced by the config — `accepted_types` accepts
>   any valid MIME string, so other types can be added as needed.

#### `cross_file_rules[]` block (relationships between boxes)

| Field | Required | What it does |
| --- | --- | --- |
| `cross_file_rules[]` | no | Optional list of rules that relate multiple boxes. Currently the supported `type` is `matching_date_suffix`, which requires the `yyyymmdd` date part of the filenames to be equal across the listed `boxes`. It's only enforced across boxes that actually have a file, so it works with optional boxes. Each rule is `{ type = "matching_date_suffix", boxes = ["id1", "id2"] }`, and every id must reference a real box. |

Config is validated at `terraform plan`/`apply` time (`terraform_data.service_config_validation`):
`service_id` format, at least one box, unique box ids, each box has at least one accepted
type/extension, and `cross_file_rules` reference existing boxes. Invalid config fails the plan.

### Customising error messages

Each service may override any validation message under `wording.errors`. Omitted keys fall back to
the built-in defaults, so you only specify the ones you want to change. Messages are enforced in
both the browser and the Lambda, so overrides apply everywhere. Templates support `{placeholder}`
substitution.

```hcl
wording = {
  # ...page_title, heading_prefix, etc...
  errors = {
    missing_required = "You need to add the {label}"
    wrong_type       = "File is not {types}"
    wrong_filename   = "File name must match {expected}"
    names_dont_match = "File names do not match"
    empty_file       = "File is empty"
    missing_code     = "File name does not contain matching code"   # client-side only
    upload_failed    = "Upload failed — please contact {contact}"   # client-side only
  }
}
```

| Key | When shown | Placeholders |
| --- | --- | --- |
| `missing_required` | a required box has no file | `{label}` |
| `wrong_type` | file type/extension not allowed | `{types}`, `{label}` |
| `missing_code` | filename does not contain the user's code (client-side) | `{label}`, `{types}` |
| `wrong_filename` | filename does not match the expected pattern | `{expected}`, `{label}` |
| `names_dont_match` | a `matching_date_suffix` cross-file rule fails | — |
| `empty_file` | a file is 0 bytes | — |
| `upload_failed` | the S3 upload itself fails (client-side) | `{contact}` |

- `{label}` is the box label with a leading "Upload " removed.
- `{types}` is a friendly list of allowed types, e.g. `.csv` or `.csv or .txt`.
- `{expected}` is the expected filename, e.g. `CTAX_EXTRACT_E07000223_yyyymmdd.csv`.
- `{contact}` is `wording.contact_email`.

---

## Previewing a rendered page locally

The uploader pages are **not** server-rendered at runtime. Terraform's `templatefile()` (in
`modules/render_service/main.tf`) takes `scripts/template/generic-template.html`, substitutes the
wording from a service's config and a dynamically-built set of upload boxes, and uploads the
finished HTML to S3. CloudFront then serves those static files.

To see what a page looks like **without deploying to AWS**, use the local renderer. It reads the
service definitions straight from `services.tf` (single source of truth) and mirrors the Terraform
render logic (box fragments, `{code}` substitution, and the `${...}` template tokens), writing an
HTML file you can open in a browser:

```bash
# List the services defined in services.tf
node scripts/helpers/local_render.mjs --list

# Render a specific service by id
node scripts/helpers/local_render.mjs --service james-mega-service --council "Test Council" --lad 12345678

# Open the generated file (path is printed by the command)
open "scripts/preview-james-mega-service-12345678-Test-Council.html"
```

Options:

- `--service ID` — the service id to render, as defined in `services.tf` (default: the first
  service). Use `--list` to see the available ids.
- `--list` — print the service ids defined in `services.tf` (with box counts) and exit.
- `--council NAME` — council name shown in the page heading (default: `Example Council`).
- `--lad CODE` — LAD code injected into the filename descriptions (default: `12345678`).
- `--config file.json` — render from a JSON config file instead of `services.tf`. The JSON must have
  the same shape as a service entry (`service_id`, `wording`, `boxes`).
- `--out file.html` — write to a specific output path.

Because the renderer parses `services.tf` directly, there is nothing to keep in sync — adding or
editing a service there is immediately reflected in the preview.

### Live preview (auto-reload)

For a real-time preview, run with `--watch`. The renderer starts a small local server, watches
`services.tf` and the HTML template, and auto-reloads the browser whenever either changes — so you
can edit a service's wording or boxes and see the result instantly:

```bash
node scripts/helpers/local_render.mjs --service james-mega-service --watch
# then open http://localhost:3000
```

- `--watch`, `-w` — watch `services.tf` and the template, serve on localhost, and auto-reload the
  browser on changes.
- `--port PORT` — change the dev server port (default: `3000`).

Leave it running while you edit `services.tf`; each save re-renders and the open tab reloads itself.
Press `Ctrl+C` to stop. (The auto-reload uses a tiny long-poll snippet injected into the served
page — no extra dependencies or build step.)

> Note: the page pulls CSS/JS from the ONS Design System CDN, so an internet connection is needed
> for it to render with full styling. The preview is static — the upload button and presigned-URL
> flow will not actually submit anything locally.

---

## Naming note (shared vs service-specific infrastructure)

Most infrastructure is intentionally **generic and shared** by all services and does not need
changing when you add a service: the CloudFront distribution, WAF (`uploader-waf-cloudfront`), ACM
certificate, Route53 record, API Gateway (`UploaderAPI`), the host and ingest S3 buckets, and the
S3 ingest lifecycle rules (one 14-day expiry rule is generated per service prefix automatically).

A few names still reference "ct"/"council tax" for historical reasons and are **naming-only** (they
do not limit the platform to Council Tax). These intentionally keep their current names because
renaming them would require renaming external resources:

- The alerting Slack secret `ct_uploader_slack` and the `ct-uploader-alerts` module in `alerts.tf` /
  `local.tf` reference a real Secrets Manager secret. Rename only if that secret is also renamed.
