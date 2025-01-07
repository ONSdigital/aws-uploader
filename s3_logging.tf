module "cloudfront_logging_bucket" {
  #checkov:skip=CKV_TF_1:using versioning instead of git commit hashes
  source      = "git::https://github.com/ONSdigital/aws-s3-bucket.git?ref=v6.1.0"
  bucket_name = var.cloudfront_logging_bucket
  versioning  = true
  tiering     = false
  logging     = false

  attach_secure_transport_policy = true

}