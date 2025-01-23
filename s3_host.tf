#tfsec:ignore:aws-s3-enable-bucket-logging
#tfsec:ignore:aws-s3-enable-versioning
module "ons_upload_bucket" {
  #checkov:skip=CKV_TF_1:using versioning instead of git commit hashes
  source      = "git::https://github.com/ONSdigital/aws-s3-bucket.git?ref=v6.0.0"
  bucket_name = var.upload_host_bucket_name
  versioning  = true
  tiering     = false
  logging     = false

  attach_secure_transport_policy = false

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
      values   = ["arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.s3_distribution.id}"]
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

data "aws_s3_bucket" "upload_bucket" {
  bucket = var.upload_host_bucket_name
}

resource "aws_s3_bucket_website_configuration" "ons_upload_configuration" {
  bucket = module.ons_upload_bucket.bucket_id

  index_document {
    suffix = "index.html"
  }
}

resource "aws_s3_object" "council_tax_folder" {
  bucket  = module.ons_upload_bucket.bucket_id
  key     = "council-tax/"
  content = ""
}

resource "aws_s3_object" "home_page" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/index.html"
  source       = "${path.module}/scripts/index.html"
  source_hash  = filemd5("${path.module}/scripts/index.html")
  content_type = "text/html"
}

resource "aws_s3_object" "success_page" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/success.html"
  source       = "${path.module}/scripts/success.html"
  source_hash  = filemd5("${path.module}/scripts/success.html")
  content_type = "text/html"
}

resource "aws_s3_object" "error_page" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/error.html"
  source       = "${path.module}/scripts/error.html"
  source_hash  = filemd5("${path.module}/scripts/error.html")
  content_type = "text/html"
}

resource "aws_s3_object" "not_csv_page" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/not_CSV_error.html"
  source       = "${path.module}/scripts/not_CSV_error.html"
  source_hash  = filemd5("${path.module}/scripts/not_CSV_error.html")
  content_type = "text/html"
}

resource "aws_s3_object" "file_names_dont_match_page" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/file_names_dont_match_error.html"
  source       = "${path.module}/scripts/file_names_dont_match_error.html"
  source_hash  = filemd5("${path.module}/scripts/file_names_dont_match_error.html")
  content_type = "text/html"
}

resource "aws_s3_object" "_012345678-council" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/_012345678-council.html"
  source       = "${path.module}/scripts/_012345678-council.html"
  source_hash  = filemd5("${path.module}/scripts/_012345678-council.html")
  content_type = "text/html"
}

resource "aws_s3_object" "_012345678-council2" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/_012345678-council2.html"
  source       = "${path.module}/scripts/_012345678-council2.html"
  source_hash  = filemd5("${path.module}/scripts/_012345678-council2.html")
  content_type = "text/html"
}

resource "aws_s3_object" "file_submission" {
  bucket = module.ons_upload_bucket.bucket_id
  key    = "council-tax/file_submission.js"
  content = templatefile("${path.module}/scripts/file_submission.js", {
    api_url = aws_apigatewayv2_stage.api.invoke_url
  })
  content_type = "text"
}

resource "aws_s3_object" "result_message" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/result_message.js"
  source       = "${path.module}/scripts/result_message.js"
  source_hash  = filemd5("${path.module}/scripts/result_message.js")
  content_type = "text"
}

