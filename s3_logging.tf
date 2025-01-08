# module "cloudfront_logging_bucket" {
#   #checkov:skip=CKV_TF_1:using versioning instead of git commit hashes
#   source      = "git::https://github.com/ONSdigital/aws-s3-bucket.git?ref=v6.1.0"
#   bucket_name = var.cloudfront_logging_bucket
#   versioning  = true
#   tiering     = false
#   logging     = false

#   attach_secure_transport_policy = true

# }

resource "aws_s3_bucket" "cloudfront_logging_bucket" {
  #checkov:skip=CKV2_AWS_61 : reason - test bucket, don't need lifecycle policy
  #checkov:skip=CKV_AWS_145 : reason - want to use AWS managed keys not CMK
  #checkov:skip=CKV_AWS_144 : reason - test bucket, don't need cross-region replication
  #checkov:skip=CKV2_AWS_62 :
  #checkov:skip=CKV_AWS_18 :
  #checkov:skip=CKV_AWS_21 :
  bucket = var.cloudfront_logging_bucket
}
resource "aws_s3_bucket_ownership_controls" "cloudfront_logging_bucket" {
  bucket = aws_s3_bucket.cloudfront_logging_bucket.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "cloudfront_logging_bucket" {
  bucket = aws_s3_bucket.cloudfront_logging_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}



#tfsec:ignore:aws-s3-encryption-customer-key
resource "aws_s3_bucket_server_side_encryption_configuration" "cloudfront_logging_bucket" {
  #checkov:skip=CKV2_AWS_67 :
  bucket = aws_s3_bucket.cloudfront_logging_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_acl" "cloudfront_logging_bucket" {

  bucket = aws_s3_bucket.cloudfront_logging_bucket.id
  acl    = "log-delivery-write"
}