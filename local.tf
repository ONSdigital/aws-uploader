locals {
  website_address = "uploader.${var.domain_name}"
  s3_domain       = "https://${module.ons_upload_ingest_bucket.bucket_id}.s3.${data.aws_region.current.name}.amazonaws.com"
}
