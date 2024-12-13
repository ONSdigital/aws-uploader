module "ons_upload_ingest_bucket" {
  #checkov:skip=CKV_TF_1:using versioning instead of git commit hashes
  source      = "git::https://github.com/ONSdigital/aws-s3-bucket.git?ref=v6.1.0"
  bucket_name = var.upload_ingest_bucket_name
  versioning  = true
  tiering     = false
  logging     = false

  attach_secure_transport_policy = true

}

data "aws_s3_bucket" "ingest_bucket" {
  bucket = var.upload_ingest_bucket_name
}