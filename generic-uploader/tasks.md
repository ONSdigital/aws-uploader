# Implementation Plan — Generic Configurable Uploader

Each task is incremental, builds on the previous, and ends in a working/verifiable state.
Council Tax parity is preserved throughout: the generic refactor (tasks 1–6) must reproduce the
current site before any new service is added. Requirement references map to `requirements.md`.

- [ ] 1. Define the service configuration model in Terraform
  - Create `services/council-tax.tf` declaring a `service_id = "council-tax"` config object:
    wording (`heading_prefix = "Council Tax - "`, `contact_email = "council.tax@ons.gov.uk"`,
    `page_title`, `uploading_banner`, `submit_text`), and `boxes` for `extract`
    (`filename_prefix = "CTAX_EXTRACT_"`, required, `accepted_types = ["text/csv"]`,
    `accepted_extensions = [".csv"]`) and `mani` (`filename_prefix = "CTAX_MANI_"`, required, same
    CSV type lists), plus
    `cross_file_rules = [{ type = "matching_date_suffix", boxes = ["extract","mani"] }]`
    and `onboarding_csv = "councils.csv"`.
  - Aggregate services into a `local.services` map in a new `services.tf`.
  - Add plan-time validation: `service_id` matches `^[a-z0-9-]+$` and is unique; `boxes` non-empty
    (length 1..N) with unique ids; each box has at least one accepted type/extension; and
    `cross_file_rules` reference existing box ids.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 2. Generalise the rendering module to `modules/render_service`
  - Copy `modules/render_council` to `modules/render_service`; replace inputs with
    `service_config`, `user_name`, `lad_code`, `bucket-id`, `template_path`.
  - Compute `heading = "${service_config.wording.heading_prefix}${user_name}"` and build the
    per-box HTML fragments in a `local` via a `for` expression over `service_config.boxes`
    (label, description with `{code}`→`lad_code` substitution, `required` indicator, `accept`).
  - Preserve the existing clean-name derivation and write to
    `<service_id>/<lad_code>-<clean_name>.html`.
  - Keep `outputs.tf` `hash` output.
  - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 3.5_

- [ ] 3. Create the generic HTML template
  - Add `scripts/template/generic-template.html` from the existing
    `council-tax-template.html`, replacing the two hardcoded EXTRACT/MANI field blocks with a
    single `${upload_boxes_html}` placeholder, and parameterising `<title>` (`${page_title}`),
    `<h1 id="council-name">` (`${heading}`), submit text (`${submit_text}`), and the uploading
    banner text.
  - Preserve all ONS Design System markup, header/footer SVGs, accessibility attributes, and the
    error-panel structure (`errors-list`, per-box error panels keyed by box id).
  - Ensure the fixed uptime-check label is preserved for the Council Tax service (via its config).
  - _Requirements: 2.2, 2.3, 2.7, 8.4_

- [ ] 4. Emit per-service client config and generalise `file_submission.js`
  - In `s3_host.tf`, publish `<service_id>/config.js` setting `window.UPLOADER_CONFIG` from the
    JSON-encoded service config (via `templatefile`/`jsonencode`).
  - Refactor `scripts/file_submission.js` to read `window.UPLOADER_CONFIG`, resolve each box input
    by id, and run the validation loop (required-empty blocks; optional-empty skips;
    present-validated against the box's `accepted_types`/`accepted_extensions` lists and
    `^<prefix><code>_\d{8}\.(ext1|ext2|...)$`). Set each input's `accept` attribute from the
    accepted-extensions/types list.
  - Replace the hardcoded two-file submit handler with a loop; build the request as
    `?serviceId=&councilName=&files=<json>`; `Promise.all` upload the returned per-box descriptors
    reusing the existing single-PUT and multipart functions.
  - Source error strings and contact email from config.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [ ] 5. Generalise the `PreSignedURL` Lambda
  - Bundle service configs as JSON available to the Lambda; load by `serviceId`.
  - Parse the `files` array; validate each file size≠0, type/extension against the box's
    `accepted_types`/`accepted_extensions` lists, and filename against a regex built from the box
    `filename_prefix` + code + `\d{8}` + extension alternation (replacing fixed-offset slicing and
    the hardcoded `text/csv` check). Apply `cross_file_rules`.
  - Build keys as `<service_id>/<councilName>/<formattedDate>/<fileName>` in `createUploadData`.
  - Return `{ message, uploads: { <boxId>: descriptor } }`; keep single/multipart descriptor shapes.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 6. Wire multi-service rendering in `s3_host.tf` and verify Council Tax parity
  - Replace the single `local.councils-csv`/`module.render_council` with iteration over
    `local.services`, decoding each service's `onboarding_csv` and flattening to
    `(service_id, user)` pairs for `module.render_service`.
  - Publish per-service `success.html`, `file_submission.js` (api_url injected), `result_message.js`,
    and `config.js` under the service prefix.
  - Run `terraform validate`/`plan`; confirm Council Tax pages render at the same URLs with
    unchanged wording, two boxes, patterns, and S3 key layout (Requirement 8 regression).
  - _Requirements: 2.1, 3.1, 3.2, 3.3, 3.4, 8.1, 8.2, 8.3, 8.5_

- [ ] 7. Update CloudFront invalidation for new service paths
  - Extend the CloudFront invalidation path set to include `/<service_id>/*` for each service.
  - Confirm existing CSP permits the API endpoints and ingest S3 origin for same-origin paths
    (no change expected).
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 8. Add the Electoral Register service config and onboarding CSV
  - Create `electoral-register.csv` seeded from the existing council list.
  - Create `services/electoral-register.tf`: `service_id = "electoral-register"`, ER wording
    (title/heading/contact), boxes `extract` (`ER_EXTRACT_`, required) and `mani` (`ER_MANI_`,
    optional), `matching_date_suffix` rule over both boxes, `onboarding_csv = "electoral-register.csv"`.
  - Add to `local.services`.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.7_

- [ ] 9. Behaviour and unit tests
  - Add `ER_*` fixtures under `features/test_files/`.
  - Cucumber scenarios: compulsory-only ER upload succeeds; both ER files validated and uploaded;
    optional omitted passes; Council Tax two-required regression incl. date-match; single-box
    service required-only.
  - Lambda unit tests: N-file validation, pattern/type checks, per-service key layout, cross-file
    rules, backwards-compatible Council Tax requests.
  - _Requirements: 4.*, 5.*, 7.5, 7.6, 8.2, 8.3_

- [ ] 10. Documentation and onboarding helper
  - Update `README.md`: service-config model, how to add a service, path-based URLs per service,
    and per-service onboarding CSVs.
  - Update/extend the onboarding helper (`scripts/helpers/onboard_councils/`) to target a chosen
    service's CSV, or document reusing it for `electoral-register.csv`.
  - _Requirements: 1.1, 3.1, 3.2, 7.4_
