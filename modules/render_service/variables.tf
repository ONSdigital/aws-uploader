variable "service_config" {
  type        = any
  description = "The full service configuration object (see local.services in services.tf)."
}

variable "user_row" {
  type        = map(string)
  description = <<-EOT
    One decoded row from the service's onboarding CSV, as a map of
    column-name => value (e.g. { name = "Essex", lad_code = "E07000223" }).
    Every CSV column is available here, so page_filename_template and the
    heading/{code} substitutions can reference any column the service defines.
  EOT
}

variable "filename_body" {
  type        = string
  description = <<-EOT
    The rendered page's filename without the ".html" extension, derived in
    services.tf from the service's page_filename_template (default
    "{lad_code}-{name}") and the user_row. Passed in rather than recomputed
    here so the S3 object key and the Terraform state key stay identical.
  EOT
}

variable "bucket-id" {
  type        = string
  description = "The ID of the S3 bucket where the rendered HTML will be stored."
}

variable "template_path" {
  type        = string
  description = "Path to the generic HTML template that will be rendered."
}
