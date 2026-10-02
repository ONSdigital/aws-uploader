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
# To add a new service: add an entry to local.services and an onboarding CSV.
# ---------------------------------------------------------------------------

locals {
  services = {
    # ----------------------------------------------------------------------
    # Electoral Register (first new service). N = 2 boxes: 1 required, 1 optional.
    # NOTE: filename convention (ER_EXTRACT_/ER_MANI_) is a placeholder; adjust
    # the prefixes / accepted_* lists here when the real convention is known.
    # ----------------------------------------------------------------------
    "electoral-register" = {
      service_id     = "electoral-register"
      onboarding_csv = "data/electoral-register.csv"

      wording = {
        page_title       = "ONS-Uploader"
        heading_prefix   = "Electoral Register - "
        contact_email    = "elections@ons.gov.uk"
        uploading_banner = "Uploading. Do not refresh or close the page."
        submit_text      = "Submit"
      }

      boxes = [
        {
          id                  = "extract"
          label               = "Upload the Electoral Register file"
          description         = "File must be named with the format 'ER_EXTRACT_{code}_yyyymmdd' where the 8 digits are your LAD code and yyyymmdd is the data run date"
          required            = true
          accepted_types      = ["text/csv"]
          accepted_extensions = [".csv"]
          filename_prefix     = "ER_EXTRACT_"
        },
        {
          id                  = "mani"
          label               = "Upload the Marked Register file (optional)"
          description         = "File must be named with the format 'ER_MANI_{code}_yyyymmdd' where the 8 digits are your LAD code and yyyymmdd is the data run date"
          required            = false
          accepted_types      = ["text/csv"]
          accepted_extensions = [".csv"]
          filename_prefix     = "ER_MANI_"
        },
                {
          id                  = "James's Magic Box"
          label               = "Upload James's magic file"
          description         = "File must be named with the format 'ER_EXTRACT_{code}_yyyymmdd' where the 8 digits are your LAD code and yyyymmdd is the data run date"
          required            = true
          accepted_types      = ["text/csv"]
          accepted_extensions = [".csv"]
          filename_prefix     = "ER_EXTRACT_"
        },
      ]

      cross_file_rules = [
        { type = "matching_date_suffix", boxes = ["extract", "mani"] },
      ]
    }
  }

  # Flattened (service_id, user) pairs across every service's onboarding CSV.
  # Each element renders one static page.
  service_user_pairs = flatten([
    for svc_id, svc in local.services : [
      for user in csvdecode(file("./${svc.onboarding_csv}")) : {
        key          = "${svc_id}/${user.lad_code}"
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
