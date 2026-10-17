# Handover: deploying the generic-uploader code into `aws-uploader` (dev only)

## Who this is for

You are an agent working in the **`aws-uploader`** repository. A human is copying the files
from the **`aws-generic-uploader`** repo onto a feature branch of `aws-uploader`
(branch: `generic-uploader-poc`) and wants to deploy to the **dev** environment only.

This document tells you what the change is, the one hard constraint that must not be
violated, the exact traps to avoid when merging the files, and how to verify the deploy
before and after apply.

---

## The single most important constraint

**The already-disseminated Council Tax URLs must not change or break.**

Users have been given deep links of the form:

```
https://uploader.ingest-dev.aws.onsdigital.uk/council-tax/<lad_code>-<clean-name>.html
# e.g. https://uploader.ingest-dev.aws.onsdigital.uk/council-tax/E07000171-Bassetlaw.html
```

Every change below has been designed to preserve these URLs exactly. If any step would
change a council-tax page's S3 key, its host bucket, or the CloudFront distribution that
serves it, **stop and raise it with the human** before applying.

---

## What this change does

`aws-uploader` is today a single-purpose Council Tax uploader. The generic-uploader code
generalises it into a **config-driven multi-service** uploader: each "service" is one
uploader version, identified by a `service_id` that becomes both the URL path prefix and
the S3 key prefix. Services are defined in `services.tf` (`local.services`).

After this change the same stack serves:

- `/council-tax/...`        (the existing live service, unchanged URLs)
- `/electoral-register/...` (new)
- `/james-mega-service/...` (new, a demo/test service)

Adding a service is config-only: a `local.services` entry plus a `data/<service>.csv`
onboarding file. No HTML/JS/Lambda edits are needed per service.

### Why Council Tax URLs stay identical

1. The council-tax service uses `service_id = "council-tax"` (same path prefix) and
   `onboarding_csv = "data/councils.csv"`.
2. `data/councils.csv` in the generic repo has been synced to be a **byte-for-byte copy**
   of the live `aws-uploader/councils.csv` (328 councils, LF line endings, trailing
   newline).
3. The rendered page filename is derived with the **same expression** the live repo uses:
   `"${lad_code}-${replace(replace(name, "/[^A-Za-z0-9-_ ]/", ""), " ", "-")}.html"`.
4. The upload-ingest S3 key for council-tax is identical: the generic Lambda writes
   `${serviceId}/${councilName}/${date}/${file}`, which for `serviceId = "council-tax"`
   equals the live `council-tax/${councilName}/${date}/${file}`. So the NiFi
   `nifi-s3-sqs-notification` pickup is unaffected.

This was verified by generating the full set of council-tax URLs from both repos' CSVs
and diffing them: **328 vs 328, identical, zero differences.**

### The duplicate LAD code fix (already applied — do not undo)

Four Somerset councils share LAD code `E06000066` (Mendip, Sedgemoor, Somerset West &
Taunton, South Somerset). In `aws-uploader` this was handled (commit `2093b80`) by keying
the `render_council` `for_each` on `lad_code-cleanname` instead of `lad_code` alone.

The generic repo carries the equivalent fix in `services.tf` → `local.service_user_pairs`,
whose map key is:

```hcl
key = "${svc_id}/${user.lad_code}-${replace(replace(user.name, "/[^A-Za-z0-9-_ ]/", ""), " ", "-")}"
```

This only affects the Terraform state map key, not the rendered filename or URL. If you see
a "Duplicate object key" error on `module.render_service`, it means this key reverted to
`${svc_id}/${user.lad_code}` — restore the `lad_code-cleanname` form.

---

## TRAPS when copying files from aws-generic-uploader → aws-uploader

The two repos look almost identical but diverge in ways that will break the live site if
copied blindly. **Do NOT overwrite the following live `aws-uploader` files with the generic
versions.**

### 1. `env/dev.tfvars` — KEEP the live bucket names (highest risk)

The two repos use **different bucket names** in dev. The host bucket is the one CloudFront
serves council-tax pages from. If you deploy with the generic bucket names, council-tax
pages render into a brand-new empty bucket and **every live URL breaks**, even though the
keys are identical.

| var | live `aws-uploader` (KEEP THIS) | generic (DO NOT USE) |
| --- | --- | --- |
| `upload_host_bucket_name`   | `aws-uploader-ost-dev`            | `aws-generic-uploader-ost-dev` |
| `upload_ingest_bucket_name` | `aws-uploader-ingest-ost-dev`     | `aws-generic-uploader-ingest-ost-dev` |
| `cloudfront_logging_bucket` | `cloudfront-logging-ost-dev`      | `cloudfront-logging-generic-uploader-ost-dev` |

**Action:** keep `aws-uploader/env/dev.tfvars` exactly as it is. The other values
(`environment = "dev"`, `domain_name = "ingest-dev.aws.onsdigital.uk"`,
`sqs_notification_id = "nifi-s3-sqs-notification"`, `target_account_id = "055232432732"`)
are the same in both repos and are correct.

### 2. Backend / Terraform state — deploy against the LIVE dev state

`aws-uploader` deploys via Concourse (`ci/tasks/terraform/terraform-apply.sh`), which runs
`terraform init -backend-config=key="${TF_STATE}" ...`. Use the **existing aws-uploader dev
`TF_STATE` key**, not a new one. Deploying generic code against the existing dev state is
what makes this an in-place upgrade of the live stack rather than a parallel stack.

Do **not** copy anything from the generic repo's `remote-state/` or backend config.

### 3. Module rename: `render_council` → `render_service`

The generic repo replaces `modules/render_council` with `modules/render_service`, and
`s3_host.tf` calls `module.render_service` instead of `module.render_council`. In Terraform
state the old council pages are addressed as
`module.render_council["<key>"].aws_s3_object.council-rendered` and the new ones as
`module.render_service["council-tax/<key>"].aws_s3_object.service-rendered`.

Terraform will see this as **destroy old + create new** for all 328 council pages. The S3
*key* (the URL) is unchanged, so the file content at each URL is simply rewritten — but
there may be a brief window during apply where a page object is being replaced.

**Decision point for the human:** either (a) accept the destroy/recreate of the 328 page
objects (the keys/URLs are preserved, so this is low user impact, especially in dev), or
(b) do `terraform state mv` from the old module addresses to the new ones to avoid churn.
For **dev**, option (a) is usually fine. Flag option (b) if the human wants zero object
replacement. Do not guess — confirm which they want before apply.

### 4. `scripts/` differences

- Generic uses a single `scripts/template/generic-template.html`; live used
  `scripts/template/council-tax-template.html`. Keep the generic template (the council-tax
  service config reproduces the same page).
- Generic has no `scripts/council-tax/` directory. Live served a `council-tax/index.html`
  landing page (see trap 5).
- The generic `scripts/` contains throwaway `preview-*.html` files from the local renderer.
  Do not deploy these; they are not referenced by Terraform. Safe to delete.

### 5. `council-tax/index.html` landing page — verify it is not needed

Live `aws-uploader/s3_host.tf` published a `council-tax/index.html` object. The generic
repo does **not** emit a per-service landing index. Deep page URLs
(`/council-tax/<lad>-<name>.html`) are fully covered, but a bare `/council-tax/` URL would
404 after this change.

**Action:** confirm with the human whether the bare `/council-tax/` landing URL was ever
disseminated. If it was, either keep a `council-tax/index.html` object or add a redirect.
If only the deep per-council URLs were given out (the likely case), no action needed.

---

## Deploy procedure (dev)

1. **Merge files**, honouring every trap above (especially do not overwrite
   `env/dev.tfvars`).
2. **Format & validate locally:**
   ```bash
   terraform fmt -check
   terraform init -backend=false
   terraform validate
   ```
   Expect "Success". Pre-existing warnings about a deprecated `data.aws_region.name`
   attribute and an S3 lifecycle `rule.filter` are benign and also present on live.
3. **Plan against the live dev state** (via the normal Concourse PR pipeline, or an
   equivalent `terraform init` with the real dev backend config + `-var-file=env/dev.tfvars`).
4. **Scrutinise the plan — this is the gate. Confirm ALL of the following before apply:**
   - [ ] **No replacement or destroy** of `aws_cloudfront_distribution.uploader`.
   - [ ] **No replacement** of `aws_acm_certificate.uploader` /
         `aws_acm_certificate_validation.cert` (ACM replacement = TLS outage risk).
   - [ ] **No changes** to `aws_route53_record.uploader` (the A/alias record).
   - [ ] **No replacement** of `aws_wafv2_web_acl.uploader_waf_cloudfront`.
   - [ ] Host/ingest/logging **buckets are not being created** (they already exist — if the
         plan wants to create them, trap 1 was violated).
   - [ ] The only council-tax churn is the `render_council` → `render_service` object
         move (trap 3), and the **S3 keys are unchanged** (`council-tax/<lad>-<name>.html`).
   - [ ] New additive resources are limited to the new services'
         `electoral-register/*` and `james-mega-service/*` objects.
   If any CloudFront/cert/WAF/Route53 line shows replace or destroy, **stop and report** —
   that endangers the live domain and was not expected.
5. **Apply** (dev) once the plan passes the checklist.

---

## Post-deploy verification (dev)

```bash
# A sample of real council-tax URLs must return 200 (unchanged):
for u in \
  "https://uploader.ingest-dev.aws.onsdigital.uk/council-tax/E07000171-Bassetlaw.html" \
  "https://uploader.ingest-dev.aws.onsdigital.uk/council-tax/E07000223-Adur.html" \
  "https://uploader.ingest-dev.aws.onsdigital.uk/council-tax/E06000066-Mendip.html" \
  "https://uploader.ingest-dev.aws.onsdigital.uk/council-tax/E06000066-South-Somerset.html" ; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' "$u")  $u"
done

# A new electoral-register page should also return 200:
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://uploader.ingest-dev.aws.onsdigital.uk/electoral-register/<a-lad-from-data/electoral-register.csv>.html"
```

`aws-uploader` already has a smoke-test task (added in commit `2093b80`) that checks a 200
for every URL derived from `councils.csv` plus a negative case. Run it after apply and
confirm all council-tax URLs still pass. The negative case
(`123456789-foo`) must still 403/404.

Also verify an **end-to-end council-tax upload** still lands in the ingest bucket under
`council-tax/<council>/<date>/<file>` so the NiFi `nifi-s3-sqs-notification` picks it up
unchanged.

---

## Quick facts reference

- Account: `055232432732` (dev), region `eu-west-2`, us-east-1 for CloudFront/ACM/WAF.
- Domain: `uploader.ingest-dev.aws.onsdigital.uk` (identical in both repos).
- Terraform: `1.11.4`; AWS provider pinned `>= 5.94.1, <= 6.0.0`.
- Council-tax service: 2 upload boxes, both **required** — `CTAX_EXTRACT_` and `CTAX_MANI_`,
  `.csv` only, with a `matching_date_suffix` cross-file rule on the 8-digit date.
- The alerts module (`aws-alerts`) prefixes names with `uploader${environment}` →
  `uploaderdev...` in dev; unchanged, no action needed.

## Out of scope (do not do in this pass)

- Deploying to preprod/prod.
- Renaming any live resource (would force replacement).
- Changing `service_id = "council-tax"` or the clean-name derivation (would change URLs).
- Modifying the NiFi pipeline or `nifi-sqs` / `nifi-s3-sqs-notification`.
