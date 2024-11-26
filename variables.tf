// Add in any variables required to change the configuration of the terraform deployment
// Required variable do not require a default statement

variable "region" {
  type        = string
  default     = "eu-west-2"
  description = "Region in which to create resources"
}
variable "upload_host_bucket_name" {
  type        = string
  description = "Hosting the html for ONS Uploader webapp"
}
