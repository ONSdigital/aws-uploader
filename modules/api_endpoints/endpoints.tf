resource "aws_api_gateway_request_validator" "method" {
  name                        = "${var.path_name}-${var.http_method}-validator"
  rest_api_id                 = var.rest_api_id
  validate_request_parameters = true
  validate_request_body       = true
}

resource "aws_api_gateway_method" "method" {
  rest_api_id = var.rest_api_id
  resource_id = var.gateway_resource_id
  http_method = var.http_method
  #TODO: need api keys, possibly behind cognito?
  request_validator_id = aws_api_gateway_request_validator.method.id

  api_key_required = var.authorizer_id == "" ? true : false

  authorization        = var.authorizer_id != "" ? "COGNITO_USER_POOLS" : "NONE"
  authorizer_id        = var.authorizer_id != "" ? var.authorizer_id : null
  authorization_scopes = var.authorizer_id != "" ? ["openid"] : null

  request_parameters = var.search_terms != null ? {
    for term in var.search_terms :
    "method.request.querystring.${term}" => true
    if term != null # Only include non-null terms
  } : null
}

resource "aws_api_gateway_integration" "integration" {
  rest_api_id             = var.rest_api_id
  resource_id             = var.gateway_resource_id
  http_method             = var.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_arn

  depends_on = [aws_api_gateway_method.method]
}

resource "aws_api_gateway_method_response" "method_response" {
  rest_api_id = var.rest_api_id
  resource_id = var.gateway_resource_id
  http_method = var.http_method
  status_code = "200"

  depends_on = [aws_api_gateway_method.method]
}