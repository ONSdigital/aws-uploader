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

  #low risk -only admins use the DB

  name = "athena-s3"
  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true
    result_configuration {
      output_location = "s3://${aws_s3_bucket.cloudfront_logging_bucket.bucket}/query_results/"
      encryption_configuration {
        encryption_option = "SSE_S3"
      }
    }
  }
}

resource "null_resource" "execute_query" {
  provisioner "local-exec" {
    command = <<EOT
    $(aws sts assume-role --role-arn arn:aws:iam::${var.target_account_id}:role/aws_shared_concourse --role-session-name aws-athena-run-query --query 'Credentials.[`export#AWS_ACCESS_KEY_ID=`,AccessKeyId,`#AWS_SECRET_ACCESS_KEY=`,SecretAccessKey,`#AWS_SESSION_TOKEN=`,SessionToken]' --output text | sed $'s/\t//g' | sed 's/#/ /g')
      aws athena start-query-execution \
      --query-string "CREATE EXTERNAL TABLE IF NOT EXISTS cloudfront_standard_logs (\`date\` DATE, time STRING, x_edge_location STRING, sc_bytes BIGINT, c_ip STRING, cs_method STRING, cs_host STRING, cs_uri_stem STRING, sc_status INT, cs_referrer STRING, cs_user_agent STRING, cs_uri_query STRING, cs_cookie STRING, x_edge_result_type STRING, x_edge_request_id STRING, x_host_header STRING, cs_protocol STRING, cs_bytes BIGINT, time_taken FLOAT, x_forwarded_for STRING, ssl_protocol STRING, ssl_cipher STRING, x_edge_response_result_type STRING, cs_protocol_version STRING, fle_status STRING, fle_encrypted_fields INT, c_port INT, time_to_first_byte FLOAT, x_edge_detailed_result_type STRING, sc_content_type STRING, sc_content_len BIGINT, sc_range_start BIGINT, sc_range_end BIGINT) ROW FORMAT DELIMITED FIELDS TERMINATED BY '\t' LOCATION 's3://${aws_s3_bucket.cloudfront_logging_bucket.id}/' TBLPROPERTIES ( 'skip.header.line.count'='2' )" \
      --query-execution-context "Database=${aws_athena_database.access_logs.id}" \
      --result-configuration "OutputLocation=s3://${aws_s3_bucket.cloudfront_logging_bucket.id}/query_results/create_athena_s3_logs_table/"

    EOT
  }
}

resource "null_resource" "create_filtered_view" {
  provisioner "local-exec" {
    command = <<EOT
    $(aws sts assume-role --role-arn arn:aws:iam::${var.target_account_id}:role/aws_shared_concourse --role-session-name aws-athena-run-query --query 'Credentials.`export#AWS_ACCESS_KEY_ID=`,AccessKeyId`#AWS_SECRET_ACCESS_KEY=`,SecretAccessKey`#AWS_SESSION_TOKEN=`,SessionToken]' --output text | sed $'s/\t//g' | sed 's/#/ /g')
      aws athena start-query-execution \
      --query-string "CREATE OR REPLACE VIEW cloudfront_filtered_logs AS SELECT * FROM cloudfront_standard_logs WHERE LOWER(cs_uri_stem) NOT LIKE '%health-status%'" \
      --query-execution-context "Database=${aws_athena_database.access_logs.id}" \
      --result-configuration "OutputLocation=s3://${aws_s3_bucket.cloudfront_logging_bucket.id}/query_results/create_filtered_view/"
    EOT
  }

  depends_on = [null_resource.execute_query]
}
