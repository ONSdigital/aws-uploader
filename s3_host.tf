#tfsec:ignore:aws-s3-enable-bucket-logging
#tfsec:ignore:aws-s3-enable-versioning
module "ons_upload_bucket" {
  #checkov:skip=CKV_TF_1:using versioning instead of git commit hashes
  source      = "git::https://github.com/ONSdigital/aws-s3-bucket.git?ref=v7.4.0"
  bucket_name = var.upload_host_bucket_name
  versioning  = true
  tiering     = false
  logging     = false

  attach_secure_transport_policy           = false
  attach_deny_incorrect_encryption_headers = false

}

data "aws_iam_policy_document" "uploader_bucket" {
  statement {
    effect = "Allow"

    actions   = ["s3:GetObject"]
    resources = ["${module.ons_upload_bucket.bucket_arn}/*"]

    principals {
      type = "Service"
      identifiers = [
        "cloudfront.amazonaws.com"
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = ["arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.uploader.id}"]
    }
  }
  statement {
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [module.ons_upload_bucket.bucket_arn,
      "${module.ons_upload_bucket.bucket_arn}/*"
    ]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "uploader_bucket" {
  bucket = module.ons_upload_bucket.bucket_id
  policy = data.aws_iam_policy_document.uploader_bucket.json
}

resource "aws_s3_bucket_website_configuration" "ons_upload_configuration" {
  bucket = module.ons_upload_bucket.bucket_id

  index_document {
    suffix = "index.html"
  }
}

resource "aws_s3_object" "home_page" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "index.html"
  source       = "${path.module}/scripts/index.html"
  source_hash  = filemd5("${path.module}/scripts/index.html")
  content_type = "text/html"
}

resource "aws_s3_object" "maintenance_page" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "maintenance.html"
  source       = "${path.module}/scripts/maintenance.html"
  source_hash  = filemd5("${path.module}/scripts/maintenance.html")
  content_type = "text/html"
}

# ---------------------------------------------------------------------------
# Per-service shared assets (one copy under each service's path prefix).
# ---------------------------------------------------------------------------

# Per-service client config: exposes window.UPLOADER_CONFIG to file_submission.js.
resource "aws_s3_object" "service_config" {
  for_each     = local.services
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "${each.key}/config.js"
  content      = "window.UPLOADER_CONFIG = ${local.services_json[each.key]};"
  content_type = "text/javascript"
}

# Generic upload client (api_url injected), one copy per service.
resource "aws_s3_object" "service_file_submission" {
  for_each = local.services
  bucket   = module.ons_upload_bucket.bucket_id
  key      = "${each.key}/file_submission.js"
  content = templatefile("${path.module}/scripts/file_submission.js", {
    api_url = aws_apigatewayv2_stage.api.invoke_url
  })
  content_type = "text/javascript"
}

resource "aws_s3_object" "service_result_message" {
  for_each     = local.services
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "${each.key}/result_message.js"
  source       = "${path.module}/scripts/result_message.js"
  source_hash  = filemd5("${path.module}/scripts/result_message.js")
  content_type = "text/javascript"
}

resource "aws_s3_object" "service_success_page" {
  for_each     = local.services
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "${each.key}/success.html"
  source       = "${path.module}/scripts/success.html"
  source_hash  = filemd5("${path.module}/scripts/success.html")
  content_type = "text/html"
}

# ---------------------------------------------------------------------------
# Render one static page per (service, user) pair from the generic template.
# ---------------------------------------------------------------------------
module "render_service" {
  source         = "./modules/render_service"
  for_each       = { for pair in local.service_user_pairs : pair.key => pair }
  service_config = each.value.service
  council_name   = each.value.council_name
  lad_code       = each.value.lad_code
  bucket-id      = module.ons_upload_bucket.bucket_id
  template_path  = "${path.root}/scripts/template/generic-template.html"
}
