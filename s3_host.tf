#tfsec:ignore:aws-s3-enable-bucket-logging
#tfsec:ignore:aws-s3-enable-versioning
module "ons_upload_bucket" {
  #checkov:skip=CKV_TF_1:using versioning instead of git commit hashes
  source      = "git::https://github.com/ONSdigital/aws-s3-bucket.git?ref=v6.1.0"
  bucket_name = var.upload_host_bucket_name
  versioning  = true
  tiering     = false
  logging     = false

  attach_secure_transport_policy = true

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

resource "aws_s3_object" "home_page" {
  bucket      = module.ons_upload_bucket.bucket_id
  key         = "index.html"
  source      = "${path.module}/scripts/index.html"
  source_hash = filemd5("${path.module}/scripts/index.html")
}
