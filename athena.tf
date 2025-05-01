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

      encryption_configuration {
        encryption_option = "SSE_S3"
      }
    }
  }
}

resource "aws_athena_named_query" "create_athena_s3_table" {
  database  = aws_athena_database.access_logs.name
  name      = "create_athena_s3_logs_table"
  query     = <<EOF
CREATE TABLE IF NOT EXISTS cloudfront_standard_logs (
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
LOCATION '${aws_s3_bucket.cloudfront_logging_bucket.id}'
TBLPROPERTIES ( 'skip.header.line.count'='2' )
EOF
  workgroup = aws_athena_workgroup.access_logs.name
}

resource "null_resource" "execute_query" {
  provisioner "local-exec" {
    command = <<EOT
    $(aws sts assume-role --role-arn arn:aws:iam::${var.target_account_id}:role/aws_shared_concourse --role-session-name aws-athena-run-query --query 'Credentials.[`export#AWS_ACCESS_KEY_ID=`,AccessKeyId,`#AWS_SECRET_ACCESS_KEY=`,SecretAccessKey,`#AWS_SESSION_TOKEN=`,SessionToken]' --output text | sed $'s/\t//g' | sed 's/#/ /g')
      aws athena start-query-execution \
        --query-string '${aws_athena_named_query.create_athena_s3_table.query}' \
        --query-execution-context Database=${aws_athena_named_query.create_athena_s3_table.database} \
        --result-configuration OutputLocation='s3://${aws_s3_bucket.cloudfront_logging_bucket.bucket}/query_results/create_athena_s3_logs_table/' \
    EOT
  }
}

# resource "aws_iam_policy" "athena_execute_query_policy" {
# #checkov:skip=CKV_AWS_355:testing execute_query, fix to be implemented
# #checkov:skip=CKV_AWS_290:testing excute_query, fix to be implemented

#   name        = "AthenaExecuteQueryPolicy"
#   description = "Policy to allow Athena query execution and S3 access for query results"
#   policy      = jsonencode({
#     Version = "2012-10-17",
#     Statement = [
#       {
#         Action = [
#           "athena:StartQueryExecution",
#           "athena:GetQueryExecution",
#           "athena:GetQueryResults"
#         ],
#         Effect   = "Allow",
#         Resource = "*"
#         # Resource = [
#         #   "arn:aws:athena:::${aws_athena_workgroup.access_logs.name}",
#         #   "arn:aws:athena:::${aws_athena_database.access_logs.name}",
#         #   "arn:aws:athena:::${aws_athena_named_query.create_athena_s3_table.id}"
#         # ]
#       },
#       {
#         Action = [
#           "s3:PutObject",
#           "s3:GetObject",
#           "s3:ListBucket"
#         ],
#         Effect   = "Allow",
#         Resource = [
#           "arn:aws:s3:::${aws_s3_bucket.cloudfront_logging_bucket.bucket}",
#           "arn:aws:s3:::${aws_s3_bucket.cloudfront_logging_bucket.bucket}/*"
#         ]
#       }
#     ]
#   })
# }
# resource "aws_iam_role_policy_attachment" "attach_athena_policy" {
#   role       = aws_iam_role.cloudwatch_global.name
#   policy_arn = aws_iam_policy.athena_execute_query_policy.arn
# }
