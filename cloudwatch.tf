#tfsec:ignore:aws-cloudwatch-log-group-customer-key
resource "aws_cloudwatch_log_group" "api_gateway_log_group" {
  #checkov:skip=CKV_AWS_158:encrypted by aws
  #checkov:skip=CKV_AWS_338:don't need logs for a year
  name              = "/aws/api_gateway/${var.api_gateway_cloudwatch}"
  retention_in_days = var.cloudwatch_retention_days
}

#tfsec:ignore:aws-cloudwatch-log-group-customer-key
resource "aws_cloudwatch_log_group" "lambda_log_group" {
  #checkov:skip=CKV_AWS_158:encrypted by aws
  #checkov:skip=CKV_AWS_338:don't need logs for a year
  name              = "/aws/lambda/${var.lambda_PreSignedURL_function}"
  retention_in_days = var.cloudwatch_retention_days
}
