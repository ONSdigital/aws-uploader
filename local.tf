locals {
  website_address = "uploader.${var.domain_name}"
  formatted_api_url = trim(aws_apigatewayv2_stage.api.invoke_url, "/")
}