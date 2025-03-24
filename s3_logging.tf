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
  name   = "s3_access_logs"
  bucket = aws_s3_bucket.cloudfront_logging_bucket.id

  encryption_configuration {
    encryption_option = "SSE_S3"
  }
}

resource "aws_athena_workgroup" "access_logs" {
  #checkov:skip=CKV_AWS_82
  #checkov:skip=CKV_AWS_159
  name = "athena-s3"

  configuration {
    enforce_workgroup_configuration    = false
    publish_cloudwatch_metrics_enabled = true

    result_configuration {
      output_location = "s3://${aws_s3_bucket.cloudfront_logging_bucket.bucket}/query_results/"
    }
  }
}

resource "aws_athena_named_query" "create_athena_s3_table" {
  database  = aws_athena_database.access_logs.name
  name      = "create_athena_s3_logs_table"
  query     = <<EOF
CREATE EXTERNAL TABLE IF NOT EXISTS cloudfront_standard_logs (
  `date` DATE,
  time STRING,
  x_edge_location STRING,
  sc_bytes BIGINT,
  c_ip STRING,
  cs_method STRING,
  cs_host STRING,
  cs_uri_stem STRING,
  sc_status INT,
  cs_referrer STRING,
  cs_user_agent STRING,
  cs_uri_query STRING,
  cs_cookie STRING,
  x_edge_result_type STRING,
  x_edge_request_id STRING,
  x_host_header STRING,
  cs_protocol STRING,
  cs_bytes BIGINT,
  time_taken FLOAT,
  x_forwarded_for STRING,
  ssl_protocol STRING,
  ssl_cipher STRING,
  x_edge_response_result_type STRING,
  cs_protocol_version STRING,
  fle_status STRING,
  fle_encrypted_fields INT,
  c_port INT,
  time_to_first_byte FLOAT,
  x_edge_detailed_result_type STRING,
  sc_content_type STRING,
  sc_content_len BIGINT,
  sc_range_start BIGINT,
  sc_range_end BIGINT
)
ROW FORMAT DELIMITED 
FIELDS TERMINATED BY '\t'
LOCATION 's3://cloudfront-logging-ost-dev/'
TBLPROPERTIES ( 'skip.header.line.count'='2' )
EOF
  workgroup = aws_athena_workgroup.access_logs.name
}