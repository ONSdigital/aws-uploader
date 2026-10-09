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
