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
  #checkov:skip=CKV2_AWS_65
  bucket = aws_s3_bucket.cloudfront_logging_bucket.id
  rule {
    object_ownership = "ObjectWriter"
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


data "aws_canonical_user_id" "current" {}

data "aws_cloudfront_log_delivery_canonical_user_id" "cloudfront" {}

resource "aws_s3_bucket_acl" "cloudfront" {

  bucket = aws_s3_bucket.cloudfront_logging_bucket.id
  access_control_policy {
    grant {
      grantee {
        id   = data.aws_cloudfront_log_delivery_canonical_user_id.cloudfront.id
        type = "CanonicalUser"
      }
      permission = "FULL_CONTROL"
    }
    owner {
      id = data.aws_canonical_user_id.current.id
    }
  }
  depends_on = [aws_s3_bucket_ownership_controls.cloudfront_logging_bucket]

}
 
 resource "aws_athena_database" "access_logs" {
  name = "s3_access_logs"
  bucket = aws_s3_bucket.cloudfront_logging_bucket.id

  encryption_configuration {
    encryption_option = "SSE_S3"
  }
 }