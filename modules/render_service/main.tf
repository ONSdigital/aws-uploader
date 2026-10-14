terraform {
  #update the version of terraform as required
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.94.1"
    }
  }
}

locals {
  service_id = var.service_config.service_id
  wording    = var.service_config.wording

  # ------------------------------------------------------------------------
  # Which CSV columns drive the human-facing bits of the page. Defaulting
  # these preserves the original two-column (name + lad_code) behaviour:
  #   - heading_column: appended to wording.heading_prefix (was var.council_name)
  #   - code_column:    substituted for the {code} placeholder in box
  #                     descriptions (was var.lad_code)
  # A service with a different column layout can override either in its YAML.
  # lookup() on the row tolerates the column being absent (-> empty string).
  # ------------------------------------------------------------------------
  heading_column = lookup(var.service_config, "heading_column", "name")
  code_column    = lookup(var.service_config, "code_column", "lad_code")

  heading_value = lookup(var.user_row, local.heading_column, "")
  code_value    = lookup(var.user_row, local.code_column, "")

  heading = "${local.wording.heading_prefix}${local.heading_value}"

  # ------------------------------------------------------------------------
  # Page scope controls how a service's pages are laid out in the bucket:
  #   - "per_user" (default): one page per onboarding row, keyed by the
  #     service's page_filename_template, under "<service_id>/<body>.html".
  #   - "service": a single shared page for the whole service, rendered at
  #     the bucket root as "<service_id>.html" (no per-user sub-path).
  # The scope is read from the service config here, and services.tf applies the
  # matching page-count logic (one synthetic row for a service-scope service),
  # so the Terraform state key and the rendered S3 key stay in step.
  # ------------------------------------------------------------------------
  is_service_scope = lookup(var.service_config, "page_scope", "per_user") == "service"

  # Relative URL prefix the rendered page uses to reach its shared assets
  # (config.js, file_submission.js). A per-user page lives alongside its assets
  # under "<service_id>/", so no prefix is needed. A service-root page lives at
  # the bucket root, so it must reach into "<service_id>/" for its assets.
  asset_prefix = local.is_service_scope ? "${local.service_id}/" : ""

  # Per-page identity injected into window.UPLOADER_CONFIG.page. The client
  # reads these instead of parsing the URL, so any page_filename_template (or a
  # service-root page with no code in the URL) works. For a service-scope page
  # there is no per-user row, so code/name fall back to empty strings.
  page_identity = {
    code         = local.code_value
    council_name = local.heading_value
    asset_prefix = local.asset_prefix
    success_url  = "${local.asset_prefix}success.html"
  }
  page_identity_json = jsonencode(local.page_identity)

  # Build one ONS Design System field block per configured upload box.
  # The {code} placeholder in each box description is substituted with the
  # user's code column (lad_code by default). The accept attribute is built
  # from the box's accepted extensions and MIME types so the file picker
  # filters accordingly.
  box_fragments = [
    for box in var.service_config.boxes :
    <<-EOT
      <div class="ons-panel ons-u-mb-m" id="${box.id}-file-error">
        <p class="ons-panel__error" id="${box.id}-file-type-error" style="display: none">
          <strong id="${box.id}-file-error-text"></strong>
        </p>
        <div class="ons-field">
          <div class="ons-field">
            <label class="ons-label ons-label--with-description" for="${box.id}-input"
              aria-describedby="${box.id}-description">${box.label}${box.required ? "" : " (optional)"}</label>
            <span id="${box.id}-description" class="ons-label__description ons-input--with-description">${replace(box.description, "{code}", local.code_value)}</span>
            <input name="${box.id}" type="file" id="${box.id}-input" data-box-id="${box.id}"
              class="ons-input ons-input--text ons-input-type__input ons-input--upload"
              accept="${join(",", concat(box.accepted_extensions, box.accepted_types))}"
              aria-describedby="${box.id}-description">
          </div>
        </div>
      </div>
    EOT
  ]

  upload_boxes_html = join("\n", local.box_fragments)

  rendered-html = templatefile(var.template_path, {
    page_title         = local.wording.page_title
    heading            = local.heading
    submit_text        = local.wording.submit_text
    uploading_banner   = local.wording.uploading_banner
    upload_boxes_html  = local.upload_boxes_html
    asset_prefix       = local.asset_prefix
    page_identity_json = local.page_identity_json
  })

  # The S3 key for the rendered page.
  #   - per_user: "<service_id>/<filename_body>.html" (filename_body derived in
  #     services.tf from the service's page_filename_template, so the rendered
  #     key cannot drift from the Terraform state key).
  #   - service:  "<service_id>.html" at the bucket root (one page for the whole
  #     service).
  page-key = local.is_service_scope ? "${local.service_id}.html" : "${local.service_id}/${var.filename_body}.html"
}

resource "aws_s3_object" "service-rendered" {
  bucket       = var.bucket-id
  key          = local.page-key
  source_hash  = md5(local.rendered-html)
  content      = local.rendered-html
  content_type = "text/html"
}
