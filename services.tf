# ---------------------------------------------------------------------------
# Service definitions (generic uploader)
#
# Each "service" is one uploader "version". Everything that differs between
# services lives here: the URL/S3 path prefix, page wording, and the ordered
# list of upload boxes (1..N) with their per-box validation rules.
#
# This single definition is consumed by:
#   - modules/render_service (server-rendered HTML page per user)
#   - scripts/file_submission.js (via the generated <service_id>/config.js)
#   - src/PreSignedURL.mjs       (via the generated services config JSON)
#
# To add a new service: drop a <service_id>.yaml file in the services/ folder
# and add an onboarding CSV. (Previously services were defined inline in the
# local.services map below -- that block is kept commented out for reference.)
# ---------------------------------------------------------------------------

locals {
  # -------------------------------------------------------------------------
  # Service definitions are loaded from one folder per service under services/
  # (services/<service_id>/service.yaml, with its users list alongside it in
  # services/<service_id>/users.csv). The folder name becomes the map key.
  # Each service.yaml is yamldecode'd and then normalised so that the optional
  # cross_file_rules block always exists, giving every service object the
  # identical shape the old inline HCL map produced.
  #
  # This keeps local.services byte-for-byte equivalent to the previous inline
  # definition, so every downstream consumer (modules/render_service, the
  # browser config.js, and the Lambda SERVICES_CONFIG) is unaffected.
  # -------------------------------------------------------------------------
  _service_files = fileset("${path.module}/services", "*/service.yaml")

  _services_raw = {
    for f in local._service_files :
    dirname(f) => yamldecode(file("${path.module}/services/${f}"))
  }

  services = {
    for id, svc in local._services_raw : id => merge(svc, {
      # Default the optional cross_file_rules list when a service omits it.
      cross_file_rules = lookup(svc, "cross_file_rules", [])
      # Preserve wording as-is. We deliberately do NOT inject an empty
      # `errors` map when a service omits it: that would add an `errors: {}`
      # key to jsonencode(local.services) (the Lambda SERVICES_CONFIG and the
      # browser config.js), changing the emitted config. A service that wants
      # error overrides simply includes `wording.errors` in its YAML.
      wording = svc.wording
    })
  }

  # ----------------------------------------------------------------------
  # LEGACY: services were previously defined inline here. Preserved (commented
  # out) so the old definition can be retrieved if needed. The YAML files in
  # services/ are now the source of truth.
  # ----------------------------------------------------------------------
  # services = {
  #   # --------------------------------------------------------------------
  #   # Council Tax (the original, live service). N = 2 boxes, both required.
  #   #
  #   # This reproduces the behaviour of the legacy single-purpose aws-uploader
  #   # deployment exactly so that the already-disseminated page URLs
  #   # (/council-tax/<lad_code>-<clean-name>.html) and the upload validation
  #   # rules are preserved:
  #   #   - service_id "council-tax"            -> same URL/S3 path prefix
  #   #   - data/councils.csv                   -> same per-council pages
  #   #   - CTAX_EXTRACT_/CTAX_MANI_ prefixes   -> same filename validation
  #   #   - matching_date_suffix (extract,mani) -> same cross-file date check
  #   # Do not rename service_id or change the clean-name derivation: either
  #   # would change the live URLs.
  #   # --------------------------------------------------------------------
  #   "council-tax" = {
  #     service_id     = "council-tax"
  #     onboarding_csv = "data/councils.csv"
  #
  #     wording = {
  #       page_title       = "ONS-Uploader"
  #       heading_prefix   = "Council Tax - "
  #       contact_email    = "council.tax@ons.gov.uk"
  #       uploading_banner = "Uploading. Do not refresh or close the page."
  #       submit_text      = "Submit"
  #     }
  #
  #     boxes = [
  #       {
  #         id                  = "extract"
  #         label               = "Upload the EXTRACT file"
  #         description         = "File must be named with the format 'CTAX_EXTRACT_{code}_yyyymmdd' where the 8 digits are your LAD code and yyyymmdd is the data run date"
  #         required            = true
  #         accepted_types      = ["csv"]
  #         accepted_extensions = [".csv"]
  #         filename_prefix     = "CTAX_EXTRACT_"
  #       },
  #       {
  #         id                  = "mani"
  #         label               = "Upload the MANI file"
  #         description         = "File must be named with the format 'CTAX_MANI_{code}_yyyymmdd' where the 8 digits are your LAD code and yyyymmdd is the data run date"
  #         required            = true
  #         accepted_types      = ["csv"]
  #         accepted_extensions = [".csv"]
  #         filename_prefix     = "CTAX_MANI_"
  #       },
  #     ]
  #
  #     cross_file_rules = [
  #       { type = "matching_date_suffix", boxes = ["extract", "mani"] },
  #     ]
  #   }
  #
  #   # --------------------------------------------------------------------
  #   # Electoral Register (first new service). N = 2 boxes: 1 required, 1 optional.
  #   # NOTE: filename convention (ER_EXTRACT_/ER_MANI_) is a placeholder; adjust
  #   # the prefixes / accepted_* lists here when the real convention is known.
  #   # --------------------------------------------------------------------
  #   "electoral-register" = {
  #     service_id     = "electoral-register"
  #     onboarding_csv = "data/electoral-register.csv"
  #
  #     wording = {
  #       page_title       = "ONS-Uploader"
  #       heading_prefix   = "Electoral Register - "
  #       contact_email    = "elections@ons.gov.uk"
  #       uploading_banner = "Uploading. Do not refresh or close the page."
  #       submit_text      = "Submit"
  #     }
  #
  #     boxes = [
  #       {
  #         id                  = "extract"
  #         label               = "Upload the Electoral Register file"
  #         description         = "File must be named with the format 'ER_EXTRACT_{code}_yyyymmdd' where the 8 digits are your LAD code and yyyymmdd is the data run date"
  #         required            = true
  #         accepted_types      = ["text/csv"]
  #         accepted_extensions = [".csv"]
  #         filename_prefix     = "ER_EXTRACT_"
  #       },
  #       {
  #         id                  = "mani"
  #         label               = "Upload the Marked Register file"
  #         description         = "File must be named with the format 'ER_MANI_{code}_yyyymmdd' where the 8 digits are your LAD code and yyyymmdd is the data run date"
  #         required            = false
  #         accepted_types      = ["text/csv"]
  #         accepted_extensions = [".csv", ".txt"]
  #         filename_prefix     = "ER_MANI_"
  #       },
  #     ]
  #
  #     cross_file_rules = [
  #       { type = "matching_date_suffix", boxes = ["extract", "mani"] },
  #     ]
  #   }
  # }

  # Flattened (service_id, user) pairs across every service's onboarding CSV.
  # Each element renders one static page.
  #
  # The map key must be unique per rendered page. Some onboarding lists reuse a
  # single lad_code across multiple distinct organisations (e.g. the Council Tax
  # list has four rows sharing E06000066), so the key includes the cleaned
  # council name as well as the lad_code -- the same identity the rendered page
  # filename uses (see modules/render_service: "<lad_code>-<clean-name>.html").
  # This only affects the Terraform state key, not the page URL.
  service_user_pairs = flatten([
    for svc_id, svc in local.services : [
      for user in csvdecode(file("./${svc.onboarding_csv}")) : {
        key          = "${svc_id}/${user.lad_code}-${replace(replace(user.name, "/[^A-Za-z0-9-_ ]/", ""), " ", "-")}"
        service_id   = svc_id
        service      = svc
        council_name = user.name
        lad_code     = user.lad_code
      }
    ]
  ])

  # Per-service JSON (consumed by the browser config.js and the Lambda).
  services_json = { for svc_id, svc in local.services : svc_id => jsonencode(svc) }
}

# ---------------------------------------------------------------------------
# Plan-time validation of service configs (Requirement 1.6).
# A failing precondition aborts `terraform plan`/`apply` with a clear message.
# ---------------------------------------------------------------------------
resource "terraform_data" "service_config_validation" {
  for_each = local.services

  input = each.key

  lifecycle {
    precondition {
      condition     = can(regex("^[a-z0-9-]+$", each.value.service_id))
      error_message = "service_id '${each.value.service_id}' must match ^[a-z0-9-]+$."
    }
    precondition {
      condition     = length(each.value.boxes) >= 1
      error_message = "Service '${each.key}' must define at least one upload box."
    }
    precondition {
      condition     = length(each.value.boxes) == length(distinct([for b in each.value.boxes : b.id]))
      error_message = "Service '${each.key}' has duplicate box ids; each box id must be unique."
    }
    precondition {
      condition     = alltrue([for b in each.value.boxes : length(b.accepted_types) + length(b.accepted_extensions) >= 1])
      error_message = "Service '${each.key}' has a box with no accepted_types or accepted_extensions."
    }
    precondition {
      condition = alltrue(flatten([
        for rule in each.value.cross_file_rules : [
          for bid in rule.boxes : contains([for b in each.value.boxes : b.id], bid)
        ]
      ]))
      error_message = "Service '${each.key}' has a cross_file_rule referencing an unknown box id."
    }
  }
}
