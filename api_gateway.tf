resource "aws_apigatewayv2_api" "api" {
  name          = "UploaderAPI"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["https://${local.website_address}"]
    allow_methods = ["GET", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key", "X-Amz-Security-Token"]
    max_age       = 300
  }
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
  #checkov:skip=CKV_AWS_309: Decision Auth is not required for this API
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /pre-signed-url"
  target    = "integrations/${aws_apigatewayv2_integration.get.id}"
}


resource "aws_apigatewayv2_route" "options" {
  #checkov:skip=CKV_AWS_309: Decision Auth is not required for this API
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "OPTIONS /pre-signed-url"
  target    = "integrations/${aws_apigatewayv2_integration.options.id}"
}

resource "aws_apigatewayv2_integration" "get" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.PreSignedURL.arn #put the arn of the lambda
  integration_method     = "GET"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "options" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.PreSignedURL.arn #put the arn of the lambda
  integration_method     = "OPTIONS"
  payload_format_version = "2.0"
}
