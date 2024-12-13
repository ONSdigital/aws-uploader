# Add in any variables you which to export or be made available from your terraform here.

#Example of exporting a non sensitive value
output "website_domain" {
  value       = aws_cloudfront_distribution.s3_distribution.domain_name
  description = "domain name for the cloudfront website"
}

output "rest_api_url" {
  value       = "https://${aws_api_gateway_rest_api.rest_api.id}-${var.vpc_endpoint}.execute-api.eu-west-2.amazonaws.com/${aws_api_gateway_stage.rest_api_stage.stage_name}"
  description = "rest api url"
}

output "api_key" {
  value       = aws_api_gateway_api_key.rest_api.value
  description = "api key"
  sensitive   = true
}

output "rest_api_execution_arn" {
  value       = aws_api_gateway_rest_api.rest_api.execution_arn
  description = "Execution arn of the rest api"
}

output "unique_endpoints" {
  value = local.unique_endpoints
}