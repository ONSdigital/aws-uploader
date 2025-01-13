resource "aws_apigatewayv2_api" "api" {
  name          = "UploaderAPI"
  protocol_type = "HTTP"
}

# Create API stage
resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_log_group.arn
    format          = "{\"requestId\":\"$context.requestId\",\"ip\":\"$context.identity.sourceIp\",\"caller\":\"$context.identity.caller\",\"user\":\"$context.identity.user\",\"requestTime\":\"$context.requestTime\",\"httpMethod\":\"$context.httpMethod\",\"resourcePath\":\"$context.resourcePath\",\"status\":\"$context.status\",\"protocol\":\"$context.protocol\",\"responseLength\":\"$context.responseLength\"}"
  }
}

# Create GET route
resource "aws_apigatewayv2_route" "get" {
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "GET /pre-signed-url"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "AWS_IAM"
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.PreSignedURL.arn #put the arn of the lambda
  payload_format_version = "2.0"
}

# resource "aws_api_gateway_resource" "MyDemoResource" {
#   rest_api_id = aws_apigatewayv2_api.api.id
#   parent_id   = aws_apigatewayv2_api.api.root_resource_id
#   path_part   = "mydemoresource"
# }

# resource "aws_api_gateway_method_response" "response_200" {
#   rest_api_id = aws_apigatewayv2_api.api.id
#   resource_id = aws_api_gateway_resource.MyDemoResource.id
#   http_method = aws_api_gateway_method.MyDemoMethod.http_method
#   status_code = "200"
#   response_models = {
#     "application/json" = "MyDemoResponseModel"
#   }
#   response_parameters = {
#     "method.response.header.Content-Type"     = false
#     "method-response-header.X-My-Demo-Header" = false
#   }
# }