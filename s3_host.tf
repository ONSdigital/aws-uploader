locals {
  councils-csv = csvdecode(file("./councils.csv"))
}


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

resource "aws_s3_bucket_policy" "allowing_encoded_characters" {
  bucket = module.ons_upload_bucket.bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action = "s3:GetObject"
        Resource = "arn:aws:s3:::${module.ons_upload_bucket.bucket_id}/council-tax/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.uploader.id}"
          }
        }
      }
    ]
  })
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

resource "aws_s3_object" "council_home_page" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/index.html"
  source       = "${path.module}/scripts/council-tax/index.html"
  source_hash  = filemd5("${path.module}/scripts/council-tax/index.html")
  content_type = "text/html"
}

resource "aws_s3_object" "success_page" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/success.html"
  source       = "${path.module}/scripts/success.html"
  source_hash  = filemd5("${path.module}/scripts/success.html")
  content_type = "text/html"
}

resource "aws_s3_object" "file_submission" {
  bucket = module.ons_upload_bucket.bucket_id
  key    = "council-tax/file_submission.js"
  content = templatefile("${path.module}/scripts/file_submission.js", {
    api_url = aws_apigatewayv2_stage.api.invoke_url
  })
  content_type = "text/javascript"
}

resource "aws_s3_object" "result_message" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/result_message.js"
  source       = "${path.module}/scripts/result_message.js"
  source_hash  = filemd5("${path.module}/scripts/result_message.js")
  content_type = "text/javascript"
}


module "render_council" {
  source        = "./modules/render_council"
  for_each      = { for c in local.councils-csv : c.lad_code => c }
  lad_code      = each.value.lad_code
  council_name  = each.value.name
  bucket-id     = module.ons_upload_bucket.bucket_id
  template_path = "${path.root}/scripts/template/council-tax-template.html"
}
