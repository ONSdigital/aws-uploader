locals {
  website_address = "uploader.${var.domain_name}"
  s3_domain = "${aws_s3_bucket.upload_bucket.bucket}.s3.${data.aws_region.current.name}.amazonaws.com"
}