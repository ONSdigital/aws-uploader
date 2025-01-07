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

variable "lambda_PreSignedURL_function" {
  type        = string
  default     = "PreSignedURL"
  description = "lambda name for the PreSignedURL function"
}

variable "cloudwatch_retention_days" {
  type        = string
  description = "number of days to retain cloudwatch logs"
  default     = 30
}

variable "api_gateway_cloudwatch" {
  type        = string
  default     = "api_gateway_cloudwatch"
  description = "name_for_api_gateway_cloudwatch_group"
}

variable "cloudfront_cloudwatch" {
  type        = string
  default     = "cloudfront_cloudwatch"
  description = "cloudfront logging"
}