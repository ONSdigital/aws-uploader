module "ons_upload_ingest_bucket" {
  #checkov:skip=CKV_TF_1:using versioning instead of git commit hashes
  source      = "git::https://github.com/ONSdigital/aws-s3-bucket.git?ref=v6.0.0"
  bucket_name = var.upload_ingest_bucket_name
  versioning  = true
  tiering     = false
  logging     = false

  attach_secure_transport_policy = true
  attach_policy_statements = true
  bucket_policy_statements = {
    ingest_policy = {
      effect = "Allow"

    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = [module.ons_upload_bucket.bucket_arn, "${module.ons_upload_bucket.bucket_arn}/*"]

    principals = [{
      type = "Service"
      identifiers = [
        "cloudfront.amazonaws.com"
      ]
    }
    ]

    condition = [{
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = ["arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.s3_distribution.id}"]
    }]
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "uploader" {
  bucket = module.ons_upload_ingest_bucket.bucket_id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT"]
    allowed_origins = ["https://${local.website_address}"]
  }

}
