variable "service_config" {
  type        = any
  description = "The full service configuration object (see local.services in services.tf)."
}

variable "council_name" {
  type        = string
  description = "Name of the user/council, e.g. 'Essex'."
}

variable "lad_code" {
  type        = string
  description = "Local Authority District code, e.g. E07000223."
}

variable "bucket-id" {
  type        = string
  description = "The ID of the S3 bucket where the rendered HTML will be stored."
}

variable "template_path" {
  type        = string
  description = "Path to the generic HTML template that will be rendered."
}
