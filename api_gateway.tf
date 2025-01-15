resource "aws_apigatewayv2_api" "api" {
  name          = "UploaderAPI"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"]
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
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "GET /pre-signed-url"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "AWS_IAM"

  request_parameter {
    request_parameter_key = "fileOne"
    required              = true
  }

  request_parameter {
    request_parameter_key = "fileOneName"
    required              = true
  }

  request_parameter {
    request_parameter_key = "fileOneSize"
    required              = true
  }

  request_parameter {
    request_parameter_key = "fileOneType"
    required              = true
  }

  request_parameter {
    request_parameter_key = "fileTwo"
    required              = true
  }

  request_parameter {
    request_parameter_key = "fileTwoName"
    required              = true
  }

  request_parameter {
    request_parameter_key = "fileTwoSize"
    required              = true
  }

  request_parameter {
    request_parameter_key = "fileTwoType"
    required              = true
  }

  request_parameter {
    request_parameter_key = "ladCode"
    required              = true
  }
}


resource "aws_apigatewayv2_route" "options" {
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "OPTIONS /pre-signed-url"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "AWS_IAM"

  request_parameter {
    request_parameter_key = "fileOne"
    required              = true
  }

  request_parameter {
    request_parameter_key = "fileOneName"
    required              = true
  }

  request_parameter {
    request_parameter_key = "fileOneSize"
    required              = true
  }

  request_parameter {
    request_parameter_key = "fileOneType"
    required              = true
  }

  request_parameter {
    request_parameter_key = "fileTwo"
    required              = true
  }

  request_parameter {
    request_parameter_key = "fileTwoName"
    required              = true
  }

  request_parameter {
    request_parameter_key = "fileTwoSize"
    required              = true
  }

  request_parameter {
    request_parameter_key = "fileTwoType"
    required              = true
  }

  request_parameter {
    request_parameter_key = "ladCode"
    required              = true
  }
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.PreSignedURL.arn #put the arn of the lambda
  payload_format_version = "2.0"
}
