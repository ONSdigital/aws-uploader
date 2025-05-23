# Add in any variables required to change the configuration of the terraform deployment
# Required variable do not require a default statement

variable "region" {
  type        = string
  default     = "eu-west-2"
  description = "Region in which to create resources"
}
variable "upload_host_bucket_name" {
  type        = string
  description = "Hosting the html for ONS Uploader webapp"
}
variable "upload_ingest_bucket_name" {
  type        = string
  description = "Bucket for ingesting files"
}

variable "cloudfront_logging_bucket" {
  type        = string
  description = "Bucket for logging cloudfront distribution"
}

variable "lambda_PreSignedURL_function" {
  type        = string
  default     = "PreSignedURL"
  description = "lambda name for the PreSignedURL function"
}

variable "cloudwatch_retention_days" {
  type        = string
  description = "number of days to retain cloudwatch logs"
  default     = 365
}

variable "api_gateway_cloudwatch" {
  type        = string
  default     = "api_gateway_cloudwatch"
  description = "name_for_api_gateway_cloudwatch_group"
}

variable "domain_name" {
  type        = string
  description = "Domain name for the DNS within an account to use."
}

variable "sqs_notification_id" {
  type        = string
  description = "sqs_notification_id"
}

variable "target_account_id" {
  type        = string
  description = "Target account ID you wish to deploy to"
}

variable "public_key" {
  type = string
  default = data.aws_secretsmanager_secret_version.cloudfront_secret.secret_string.public_key
}