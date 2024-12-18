#tfsec:ignore:aws-cloudwatch-log-group-customer-key
resource "aws_cloudwatch_log_group" "stage_logs" {
  #checkov:skip=CKV_AWS_158:encrypted by aws
  #checkov:skip=CKV_AWS_338:don't need logs for a year
  name              = "/aws/restapi/tdsa/${var.rest_api_stage_name}"
  retention_in_days = 30
}
