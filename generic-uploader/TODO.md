# Generic Uploader — Outstanding Work

Follow-up tasks parked after the first implementation iteration. The core config-driven
platform is in place and verified (`terraform validate` passes; Lambda unit tests pass).
Nothing below is committed — all current changes are in the working tree.

## Status snapshot (what's already done)

- [x] Spec written: `.kiro/specs/generic-uploader/{requirements,design,tasks}.md`
- [x] Service config model in `services.tf` (`local.services`, flattened pairs, plan-time validation)
- [x] `modules/render_service` renders N boxes from config into the generic template
- [x] `scripts/template/generic-template.html` (parameterised wording + `${upload_boxes_html}`)
- [x] `scripts/file_submission.js` generalised to read `window.UPLOADER_CONFIG` and loop over boxes
- [x] `src/PreSignedURL.mjs` generalised to accept `serviceId` + `files[]`, validate per box, write under `<service_id>/`
- [x] Multi-service wiring in `s3_host.tf`, `cloudfront.tf` (per-service invalidation), `s3_upload.tf` (per-service lifecycle), `lambda.tf` (`SERVICES_CONFIG`)
- [x] Electoral Register service added (`services.tf` + `electoral-register.csv`, seeded small)
- [x] Removed Council-Tax-specific leftovers: `modules/render_council`, `scripts/template/council-tax-template.html`, `scripts/council-tax/index.html` (+ its TF resource/trigger)
- [x] Unit tests updated to the new N-file contract (`test/PreSignedURL.test.mjs`, 14 passing)

## Outstanding tasks

### 1. Generalise the onboarding helper
- [ ] **Bug:** `PROJECT_ROOT` in `scripts/helpers/onboard_councils/onboard_councils_from_xlsx.py`
      resolves the repo root by finding a parent dir literally named `aws-uploader`
      (`next(p for p in ... if p.name == "aws-uploader")`). This repo is `aws-generic-uploader-poc`,
      so that `next(...)` raises `StopIteration`. Fix to detect the root robustly (e.g. walk up to
      the dir containing `services.tf`/`.git`, or make it a required/derived argument).
- [ ] Update `scripts/helpers/onboard_councils/` so it can target an arbitrary service's CSV
      (e.g. a `--service` / output-path argument) instead of hardcoding `data/councils.csv`.
- [ ] Default output path is now `data/councils.csv` (CSVs moved under `data/`); keep the helper
      and its tests consistent with that location.
- [ ] Update `scripts/helpers/onboard_councils/README.md` accordingly.
- [ ] Update the Python helper tests under `test/scripts/helpers/onboard_councils/`.

### 2. Populate the full Electoral Register council list
- [ ] Replace the seed rows in `electoral-register.csv` (currently Test, Adur, Birmingham)
      with the full council list (reuse `councils.csv` or source from the real onboarding sheet).
- [ ] Confirm the ER filename convention is correct (currently placeholder `ER_EXTRACT_` /
      `ER_MANI_` in `services.tf`) and adjust prefixes / accepted types if needed.

### 3. Update behaviour & performance tests (still assume the old two-file CT page)
- [ ] Cucumber behaviour tests in `features/` — update step defs / selectors for the generic
      page (box ids `<boxId>-input`, config-driven validation) and add scenarios:
      compulsory-only ER upload, optional box omitted, both files, CT two-required regression.
- [ ] Add `ER_*` fixtures under `features/test_files/`.
- [ ] `test/performance_testing/test_council_tax_html.py` — update to the generic page markup
      (or generalise to cover any service).

### 4. Optional: demonstrate N files end-to-end
- [ ] Add a 5-box example service to `services.tf` (real throwaway or commented template).
- [ ] Add a unit test proving 5 files flow through the Lambda.

### 5. Decide on per-service landing pages
- [ ] The Council Tax landing page (`council-tax/index.html`) was removed. Decide whether a
      per-service landing page is needed (e.g. for the bare `/<service_id>/` path). If so, add
      a config-driven landing page in `render_service` / `s3_host.tf`.

## Known notes / caveats

- **Request transport ceiling:** `files[]` is passed as a URL-encoded JSON query param on a
  `GET /pre-signed-url`. Fine for a handful of files; if a service ever needs many files with
  long names, switch to `POST` with the array in the body.
- **Code derivation:** `codeFromFiles` in `PreSignedURL.mjs` derives the user's LAD code by
  regex-matching the first filename against its box `filename_prefix`. Services whose boxes have
  no prefix convention would fall back to `'unknown'`.
- **Type validation is lenient (extension OR MIME):** a file is accepted if its extension OR its
  MIME type is allowed. Switch to strict AND semantics in `typeAllowed` (Lambda + client) if
  required.
- **Naming-only CT references left intentionally:** `ct_uploader_slack` secret + `ct-uploader-alerts`
  module (`local.tf` / `alerts.tf`) reference a real Secrets Manager secret; rename only if that
  secret is also renamed.
- **Nothing committed yet** — review the working tree before committing.

### Support services whose pages key off an arbitrary set of CSV columns (not fixed name + lad_code)

**Motivation.** Today every service assumes a fixed two-column onboarding CSV (`name`, `lad_code`)
and builds the page filename as `<lad_code>-<clean-name>.html`. The two-column case is just one
instance of a more general need: a service should be able to derive its URLs from **any number of
columns** — one, two, or more — in any order. Examples:
- `foo` keys off a **single** column (just an id, or just a name) → page `<clean-id>.html`.
- a service keys off **three** columns → page `<a>-<b>-<c>.html`.
- the existing services keep the current two-column `<lad_code>-<clean-name>.html` form.

So the goal is a **configurable, N-column identity**, with today's `name`+`lad_code` layout being
the default when a service doesn't specify otherwise.

**Where the two-column assumption is currently hardcoded:**
- `services.tf` → `local.service_user_pairs`: iterates `csvdecode(...)` and reads `user.lad_code`
  and `user.name`, builds the state key `"${svc_id}/${user.lad_code}-${clean(user.name)}"`, and
  passes `council_name` / `lad_code` into the module.
- `modules/render_service/`: `variables.tf` requires both `council_name` and `lad_code`;
  `main.tf` builds `page-filename = "${lad_code}-${clean-council-name}.html"` and the heading
  from `council_name`.
- `scripts/file_submission.js`: `extractCodeFromURL()` / `extractCouncilNameFromURL()` split the
  page filename on the first `-` to recover `code` and `name`. The `code` is used for the
  per-file filename validation (`{code}` in the pattern) and sent to the Lambda.
- `src/PreSignedURL.mjs`: expects `councilName` + the derived code when building the ingest key.
- `test/smoke/check_council_urls.js`: `parseCsv` requires `name` + `lad_code` headers and
  `buildUrl` assumes `<lad_code>-<clean-name>.html`.

**Design sketch (keep Council Tax / Electoral Register byte-for-byte unchanged):**
- Add an optional per-service **URL/identity schema** to the config in `services.tf` that describes
  the CSV columns and how to build the page identity from them. The schema must support an
  arbitrary number of columns, e.g.:
  ```hcl
  url_schema = {
    columns  = ["lad_code", "name"]          # the CSV columns this service onboards (ordered)
    filename = "{lad_code}-{clean(name)}"     # template referencing those columns by name;
                                              # clean(...) applies the existing name-cleaning regex
    heading  = "{name}"                       # which column(s) feed the page <h1>
    code     = "lad_code"                     # which column (if any) is the per-file validation code
  }
  ```
  When `url_schema` is omitted, default to the current behaviour exactly:
  `columns = ["name","lad_code"]`, `filename = "{lad_code}-{clean(name)}"`, `heading = "{name}"`,
  `code = "lad_code"`. A single-column service sets `columns = ["id"]`, `filename = "{clean(id)}"`;
  a three-column service lists all three and templates them.
- Generalise `local.service_user_pairs` to build the state key and filename from the schema +
  whatever columns each `csvdecode` row has, instead of the hardcoded `name`/`lad_code` fields.
  Pass a generic `row` map (column name → value) into the module rather than named
  `council_name` / `lad_code` vars.
- Generalise `modules/render_service` to accept the schema + the row map and compute
  `page-filename` and the heading from the templates (keep the clean-name regex available as the
  `clean(...)` helper). Replace the `council_name`/`lad_code` vars with a map + schema.
- Validate the schema at plan time (extend `terraform_data.service_config_validation`): every
  `{column}` referenced in `filename`/`heading`/`code` must exist in `columns`, `columns` must be
  non-empty, and the CSV header must contain exactly those columns.
- Decide the per-file **validation code** story generally: `code` names a column (default
  `lad_code`), or a service sets `code = null` to opt out of the code-in-filename rule entirely.
  `{code}` in box filename patterns then resolves to that column's value (or the rule is skipped).
- Update `scripts/file_submission.js` URL parsing to be schema-driven: don't assume the first
  `-`-delimited token is the code. The page needs to know its own schema — simplest is to include
  the row's column values in the per-service `config.js` or encode them so `config.js` can map the
  filename back to columns. Mirror the same in `src/PreSignedURL.mjs`.
- Update `test/smoke/check_council_urls.js` to read whatever columns each service's schema needs
  (it already discovers services from `services.tf`; extend it to honour `url_schema` when building
  URLs rather than assuming `name`/`lad_code`).

**Constraint:** the existing `council-tax` and `electoral-register` URLs must not change — the
default (no `url_schema`) path must reproduce `<lad_code>-<clean-name>.html` exactly. Add a test
that diffs the generated council-tax URL set before/after, as was done for the original migration.
