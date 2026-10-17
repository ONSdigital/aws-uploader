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
    page_title        = local.wording.page_title
    heading           = local.heading
    submit_text       = local.wording.submit_text
    uploading_banner  = local.wording.uploading_banner
    upload_boxes_html = local.upload_boxes_html
  })

  # The filename body (everything before ".html") is derived once in
  # services.tf from the service's page_filename_template and passed in, so
  # the rendered S3 object key cannot drift from the Terraform state key.
  page-filename = "${var.filename_body}.html"
}

resource "aws_s3_object" "service-rendered" {
  bucket       = var.bucket-id
  key          = "${local.service_id}/${local.page-filename}"
  source_hash  = md5(local.rendered-html)
  content      = local.rendered-html
  content_type = "text/html"
}
