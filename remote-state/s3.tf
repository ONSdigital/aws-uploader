#tfsec:ignore:aws-s3-enable-bucket-logging

resource "aws_s3_bucket" "terraform_state" {
  #checkov:skip=CKV2_AWS_62:event monitoring not needed for state
  #checkov:skip=CKV_AWS_18:access logging not required - using cloudwatch
  #checkov:skip=CKV_AWS_144:cross region replication not required for state
  #checkov:skip=CKV2_AWS_61: no neeed for lifecycle on state
  #checkov:skip=CKV_AWS_145: not using KMS
  bucket = "tf-state-${random_string.random.id}"

}

resource "aws_s3_bucket_versioning" "terraform_state_versioning" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

#tfsec:ignore:aws-s3-encryption-customer-key

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  #checkov:skip=CCKV_AWS_145: not using KMS
  #checkov:skip=CKV2_AWS_62: no neeed for event notifications on state


  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
