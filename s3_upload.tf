module "ons_upload_ingest_bucket" {
  #checkov:skip=CKV_TF_1:using versioning instead of git commit hashes
  source      = "git::https://github.com/ONSdigital/aws-s3-bucket.git?ref=v6.0.0"
  bucket_name = var.upload_ingest_bucket_name
  versioning  = false
  tiering     = false
  logging     = false

  attach_secure_transport_policy = false
}

resource "aws_s3_bucket_cors_configuration" "uploader" {
  bucket = module.ons_upload_ingest_bucket.bucket_id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT"]
    allowed_origins = ["https://${local.website_address}"]
  }

}


data "aws_iam_policy_document" "uploader_ingest_bucket" {
  statement {
    effect = "Allow"

    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${module.ons_upload_ingest_bucket.bucket_arn}/*"]

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
    resources = [module.ons_upload_ingest_bucket.bucket_arn,
      "${module.ons_upload_ingest_bucket.bucket_arn}/*"
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

resource "aws_s3_bucket_policy" "uploader_ingest_bucket" {
  bucket = module.ons_upload_ingest_bucket.bucket_id
  policy = data.aws_iam_policy_document.uploader_ingest_bucket.json
}

resource "aws_s3_bucket_lifecycle_configuration" "ingest_lifecycle_policy" {
  bucket = module.ons_upload_ingest_bucket.bucket_id

  rule {
    id     = "delete_after_14_days"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}


