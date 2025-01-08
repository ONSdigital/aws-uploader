module "cloudfront_logging_bucket" {
  #checkov:skip=CKV_TF_1:using versioning instead of git commit hashes
  source      = "git::https://github.com/ONSdigital/aws-s3-bucket.git?ref=v6.1.0"
  bucket_name = var.cloudfront_logging_bucket
  versioning  = true
  tiering     = false
  logging     = false

  attach_secure_transport_policy = true

}

# resource "aws_s3_bucket" "cloudfront_logging_bucket" {
#   bucket = var.cloudfront_logging_bucket
# }
# resource "aws_s3_bucket_ownership_controls" "cloudfront_logging_bucket" {
#   bucket = aws_s3_bucket.cloudfront_logging_bucket.id 
#   rule {
#     object_ownership = "BucketOwnerPreferred"
#   }
# }

# resource "aws_s3_bucket_public_access_block" "cloudfront_logging_bucket" {
#   bucket = aws_s3_bucket.cloudfront_logging_bucket.id

#   block_public_acls = true 
#   block_public_policy = true 
#   ignore_public_acls = true 
#   restrict_public_buckets = true 
# }

resource "aws_s3_bucket_acl" "cloudfront_logging_bucket" {

   bucket = module.cloudfront_logging_bucket.bucket_id
   acl = "log-delivery-write"
}