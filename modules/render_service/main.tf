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

  heading = "${local.wording.heading_prefix}${var.council_name}"

  # Build one ONS Design System field block per configured upload box.
  # The {code} placeholder in each box description is substituted with the
  # user's LAD code. The accept attribute is built from the box's accepted
  # extensions and MIME types so the file picker filters accordingly.
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
            <span id="${box.id}-description" class="ons-label__description ons-input--with-description">${replace(box.description, "{code}", var.lad_code)}</span>
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
    page_title        = local.wording.page_title
    heading           = local.heading
    submit_text       = local.wording.submit_text
    uploading_banner  = local.wording.uploading_banner
    upload_boxes_html = local.upload_boxes_html
  })

  # Preserve the existing clean-name derivation so URLs are unchanged.
  clean-council-name = replace(replace(var.council_name, "/[^A-Za-z0-9-_ ]/", ""), " ", "-")
  page-filename      = "${var.lad_code}-${local.clean-council-name}.html"
}

resource "aws_s3_object" "service-rendered" {
  bucket       = var.bucket-id
  key          = "${local.service_id}/${local.page-filename}"
  source_hash  = md5(local.rendered-html)
  content      = local.rendered-html
  content_type = "text/html"
}
