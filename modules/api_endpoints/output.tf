output "method_id" {
  value       = aws_api_gateway_method.method.id
  description = "Rest API Method ID"
}

output "integration_id" {
  value       = aws_api_gateway_integration.integration.id
  description = "Rest API Integration ID"
}

output "method_response" {
  value       = aws_api_gateway_method_response.method_response.id
  description = "Method response"
}

output "triggers" {
  value = {
    rest_api_method_response         = aws_api_gateway_method_response.method_response.id,
    rest_api_method_id               = aws_api_gateway_method.method.id,
    rest_api_find_method_integration = aws_api_gateway_integration.integration.id
  }
  description = "Rest API triggers, contains method response, method id and method integration"
}
