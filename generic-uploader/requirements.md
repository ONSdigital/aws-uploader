# Requirements — Generic Configurable Uploader

## Introduction

Today this repository deploys a single-purpose "Council Tax" file uploader: a static site on
S3 behind CloudFront that renders one page per council (from `councils.csv`) and lets each
council upload exactly two Council Tax CSV files (an `EXTRACT` file and a `MANI` file) to an
S3 ingest bucket via browser-generated presigned URLs.

The goal of this feature is to make the uploader **generic and configurable** so the same
platform can serve multiple "services" (e.g. Council Tax, Electoral Register) that differ in:

- page wording (titles, headings, labels, hint text, contact details, banners),
- the URLs/paths the pages are served from,
- the number of upload boxes/forms (1..N), including which are required vs optional,
- filename and file-type validation rules per upload box.

Each service is described by a configuration file. Users (councils or other organisations)
are onboarded per service in the same lightweight, CSV-driven way as `councils.csv` today.

The first new service to onboard is **Electoral Register**: the same councils, uploading
1 compulsory file and 1 optional file, carrying electoral register data rather than council
tax data.

### Decisions and assumptions (confirmed / recorded)

- **Routing: Option A — path-based on the existing domain.** All services are served from the
  single existing domain `uploader.<domain>` under a per-service path prefix
  (e.g. `/council-tax/...`, `/electoral-register/...`). CloudFront, the ACM certificate and
  Route53 remain unchanged.
- **Onboarding: one CSV per service.** Each service has its own onboarding CSV (e.g.
  `councils.csv`, `electoral-register.csv`) with the same `name,lad_code` columns. The same
  council can appear in multiple services' CSVs.
- **Optional files** are validated (type + filename pattern) only when a file is actually
  provided; when omitted they are skipped without error.
- **File types are configurable per upload box as a list.** Each box declares which file types it
  accepts (by MIME type and/or extension), supporting a single type (e.g. `.csv`), a different
  single type (e.g. `.txt`), or several at once (e.g. `.csv` AND `.txt`). CSV is the default for the
  initial services.
- **The number of upload boxes is configurable (1..N).** A service may present 1, 2, 3 or more
  submissions; the two-file Council Tax layout is just the N=2 case.
- **Backwards compatibility:** the existing Council Tax service must continue to work exactly
  as it does today (same URLs, wording, validation, S3 key layout) once it is expressed as a
  service config.

## Requirements

### Requirement 1 — Service configuration model

**User Story:** As a platform maintainer, I want each uploader "version" described by a single
configuration file, so that I can roll out a new uploader by adding config rather than editing
code.

#### Acceptance Criteria

1. WHEN a service configuration is defined THEN the system SHALL read all service-specific
   behaviour (path prefix, page wording, upload boxes, validation rules) from that configuration.
2. The service configuration SHALL define a unique `service_id` used as the URL path prefix and
   the S3 key prefix for that service.
3. The service configuration SHALL define page wording fields including at minimum: page title,
   heading, support/contact detail, uploading banner text, and submit button text.
4. The service configuration SHALL define an ordered list of 1..N upload boxes, where N is
   determined solely by configuration (supporting 1, 2, 3 or more submissions).
5. WHERE an upload box is defined, it SHALL include: a stable box id, a label, a description/hint,
   a `required` flag, a list of accepted file types (MIME types and/or extensions), and a filename
   pattern rule.
8. The accepted file types for a box SHALL be configurable as a list, so a box MAY accept a single
   type (e.g. `.csv`), a single alternative type (e.g. `.txt`), or multiple types together
   (e.g. `.csv` and `.txt`), without code changes.
6. WHEN a service configuration is invalid or missing required fields THEN `terraform plan`/`apply`
   SHALL fail with a clear error rather than deploying a broken page.
7. The existing Council Tax behaviour SHALL be expressible entirely as one service configuration
   with two upload boxes (`EXTRACT` required, `MANI` required) and the current wording and patterns.

### Requirement 2 — Per-service, config-driven page rendering

**User Story:** As a platform maintainer, I want each user's page generated from the service
config, so that wording and the number of upload boxes vary per service without template edits.

#### Acceptance Criteria

1. WHEN Terraform is applied THEN the system SHALL render one static HTML page per user per
   service, from a shared generic template driven by the service configuration.
2. The rendered page SHALL display the configured page wording (title, heading, hints, banners,
   contact detail, submit text).
3. The rendered page SHALL render exactly one upload input per configured upload box, in the
   configured order, each showing its configured label and description/hint.
4. WHERE a box is optional, the rendered page SHALL visually indicate it is optional.
5. The rendered page SHALL be written to S3 under `<service_id>/<lad_code>-<clean_name>.html`.
6. WHEN a filename pattern references the user's code THEN the rendered hint SHALL substitute the
   user's actual `lad_code` (e.g. `CTAX_EXTRACT_E07000223_yyyymmdd`).
7. The generic template SHALL preserve the existing ONS Design System markup, accessibility
   attributes, header/footer, and error-panel structure.

### Requirement 3 — Per-service user onboarding

**User Story:** As an operator, I want to onboard a user to a service by adding a CSV row, so
that onboarding stays as simple as it is today.

#### Acceptance Criteria

1. WHEN a row (`name,lad_code`) is added to a service's onboarding CSV AND Terraform is applied
   THEN a page for that user SHALL be rendered and published for that service.
2. The system SHALL support multiple services each with its own onboarding CSV.
3. The same `lad_code`/`name` SHALL be allowed to appear in more than one service's CSV, producing
   independent pages under each service's path.
4. WHEN a user is removed from a service's CSV AND Terraform is applied THEN that user's page for
   that service SHALL be removed.
5. The clean-name/URL derivation (strip special characters, spaces to dashes) SHALL match the
   current behaviour so existing Council Tax URLs are unchanged.

### Requirement 4 — Config-driven client-side validation and upload

**User Story:** As a user uploading files, I want the page to validate the correct number of
files against the correct rules for my service, so that I get accurate feedback before upload.

#### Acceptance Criteria

1. The client script SHALL iterate over the configured upload boxes rather than assuming exactly
   two files.
2. WHEN a required box has no file selected THEN the client SHALL show a validation error for that
   box and prevent submission.
3. WHEN an optional box has no file selected THEN the client SHALL skip validation for that box and
   allow submission.
4. WHEN a file is selected for any box THEN the client SHALL validate it against that box's
   configured filename pattern (including the user's code where applicable) and its list of accepted
   file types; a file SHALL be accepted if it matches any one of the box's allowed types/extensions
   and rejected if it matches none.
5. WHERE a service configures a cross-file consistency rule (e.g. matching date suffixes across
   boxes) THEN the client SHALL enforce it; WHERE no such rule is configured the client SHALL NOT
   enforce it.
6. WHEN validation passes THEN the client SHALL request presigned URLs for exactly the files that
   were provided and upload each file (single PUT or multipart) to its presigned URL.
7. Error messages and the support/contact detail shown SHALL come from the service configuration.
8. WHEN all uploads complete THEN the client SHALL navigate to the service's success page.

### Requirement 5 — Config-driven presigned-URL Lambda

**User Story:** As a platform maintainer, I want the presigned-URL Lambda to handle a variable
number of files and service-specific rules, so that one backend serves all services.

#### Acceptance Criteria

1. The Lambda SHALL accept a request describing 1..N files for a known `service_id` rather than a
   fixed `fileOne`/`fileTwo` pair.
2. The Lambda SHALL validate each provided file's size (non-empty) and that its type/extension is
   within the box's configured list of accepted types, accepting a file that matches any allowed
   type/extension and rejecting one that matches none.
3. The Lambda SHALL derive the user's code and validate filenames using the service's configured
   pattern rather than fixed-offset string slicing.
4. WHERE a service configures cross-file consistency rules THEN the Lambda SHALL enforce them.
5. The Lambda SHALL generate a presigned PUT URL (or multipart part URLs) for each provided file.
6. The Lambda SHALL write objects under `<service_id>/<user_name>/<date>/<filename>`.
7. WHEN validation fails THEN the Lambda SHALL return a structured message the client maps to the
   correct per-box error, consistent with current behaviour.
8. The existing Council Tax requests SHALL continue to succeed with unchanged S3 key layout.

### Requirement 6 — Routing and infrastructure (path-based, Option A)

**User Story:** As a platform maintainer, I want new services to reuse the existing domain and
distribution, so that rollout needs no new DNS or certificates.

#### Acceptance Criteria

1. All services SHALL be served from the existing `uploader.<domain>` distribution under their
   `service_id` path prefix.
2. WHEN a new service is added THEN CloudFront cache invalidation SHALL cover that service's path
   (`/<service_id>/*`).
3. The CloudFront security headers / CSP SHALL continue to permit the API Gateway presigned-URL
   and complete-multipart endpoints and the ingest-bucket S3 origin for all services.
4. The S3 ingest lifecycle, logging, and downstream SQS notification behaviour SHALL apply to
   objects uploaded under any service's prefix.
5. No new ACM certificate, Route53 record, or CloudFront alias SHALL be required to add a service.

### Requirement 7 — Electoral Register service (first new rollout)

**User Story:** As an operator, I want to launch an Electoral Register uploader for the existing
councils, so that councils can upload 1 compulsory and 1 optional electoral register file.

#### Acceptance Criteria

1. There SHALL be an `electoral-register` service configuration served under
   `uploader.<domain>/electoral-register/...`.
2. The Electoral Register service SHALL define two upload boxes: box 1 required, box 2 optional.
3. The Electoral Register wording (title, heading, labels, hints, contact detail) SHALL reflect
   electoral register data, not council tax.
4. The Electoral Register service SHALL be onboarded from its own CSV reusing the existing council
   list.
5. WHEN a council uploads only the compulsory file THEN the upload SHALL succeed.
6. WHEN a council uploads both files AND both pass validation THEN both SHALL upload and the
   success page SHALL be shown.
7. Electoral register uploads SHALL be stored under the `electoral-register/` S3 prefix, separate
   from `council-tax/`.

### Requirement 8 — Backwards compatibility and migration

**User Story:** As a platform owner, I want the existing Council Tax service to keep working
unchanged, so that rollout of the generic platform carries no regression risk.

#### Acceptance Criteria

1. AFTER migration, the Council Tax pages SHALL be served from the same URLs as today.
2. The Council Tax page wording, two upload boxes, filename patterns, and error messages SHALL be
   unchanged from the current site.
3. Council Tax uploads SHALL continue to be stored under the `council-tax/` prefix with the same
   key structure.
4. The externally monitored fixed label used for uptime checks SHALL be preserved for the Council
   Tax service.
5. Existing special rows (health status, performance test, test) SHALL continue to render as they
   do today.
