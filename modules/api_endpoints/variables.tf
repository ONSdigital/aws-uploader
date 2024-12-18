variable "http_method" {
  type = string
}

variable "path_name" {
  type = string
}

variable "search_terms" {
  type    = list(string)
  default = []
}

variable "lambda_arn" {
  type = string
}

variable "rest_api_id" {
  type = string
}

variable "gateway_resource_id" {
  type = string
}

variable "lambda_function_name" {
  type        = string
  description = "Name of the lambda"
}

variable "region" {
  type        = string
  description = "region where we deploy to"
  default     = "eu-west-2"
}

variable "authorizer_id" {
  type        = string
  default     = ""
  description = "authoriser id if required"
}
