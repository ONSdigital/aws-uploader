variable "rest_api_name" {
  type        = string
  description = "Name of the rest api"
}

variable "rest_api_stage_name" {
  type        = string
  description = "Name of the stage to deploy to"
  default     = "prod"
}

variable "api_endpoints" {
  type = list(object({
    http_method          = string
    search_terms         = optional(list(string))
    lambda_arn           = string
    lambda_function_name = string
    cognito_authorizer   = bool
    path                 = string
  }))
}

variable "endpoint_type" {
  type        = string
  description = "Type of endpoint for the rest api, edge, regional or private"
  default     = "REGIONAL"
}


variable "cache_cluster_size" {
  type        = string
  default     = "0.5"
  description = "Size of the cache in GB"
}


variable "cognito_user_pool_arn" {
  type        = list(string)
  description = "List of user pool arns"
}
