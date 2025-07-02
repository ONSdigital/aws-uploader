variable "lad_code" {
  type        = string
  description = "Local Authority District code, e.g. E07000223"
}

variable "council_name" {
  type        = string
  description = "Name of the council, e.g. 'Essex'"
}

variable "bucket-id" {
  type        = string
  description = "The ID of the S3 bucket where the rendered HTML will be stored."
}

variable "template_path" {
  type        = string
  description = "Path to the HTML template file that will be rendered for the council."
}
