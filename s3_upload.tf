module "ons_upload_ingest_bucket" {
  #checkov:skip=CKV_TF_1:using versioning instead of git commit hashes
  source      = "git::https://github.com/ONSdigital/aws-s3-bucket.git?ref=v6.0.0"
  bucket_name = var.upload_ingest_bucket_name
  versioning  = true
  tiering     = false
  logging     = false

  attach_secure_transport_policy = true
}

resource "aws_s3_bucket_cors_configuration" "uploader" {
  bucket = module.ons_upload_ingest_bucket.bucket_id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT"]
    allowed_origins = ["https://${local.website_address}"]
  }

}