#Gateway has Resources, resources are made up of methods (post, get, put, delete)

resource "aws_api_gateway_rest_api" "rest_api" {
  name = var.rest_api_name
  lifecycle {
    create_before_destroy = true
  }

  endpoint_configuration {
    types            = [var.endpoint_type]
    vpc_endpoint_ids = [var.vpc_endpoint]
  }
}

resource "aws_api_gateway_rest_api_policy" "rest_api" {
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  policy      = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "execute-api:Invoke",
            "Resource": [
                "${aws_api_gateway_rest_api.rest_api.execution_arn}/*"
            ]
        },
        {
            "Effect": "Deny",
            "Principal": "*",
            "Action": "execute-api:Invoke",
            "Resource": [
                "${aws_api_gateway_rest_api.rest_api.execution_arn}/*"
            ],
            "Condition" : {
                "StringNotEquals": {
                    "aws:SourceVpc": "${var.vpc_id}"
                }
            }
        }
    ]
}
EOF
}


resource "aws_api_gateway_resource" "rest_api_resource" {
  for_each = local.endpoint_map

  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  parent_id   = aws_api_gateway_rest_api.rest_api.root_resource_id
  path_part   = each.key
}

module "api_endpoints" {
  for_each = { for idx, endpoint in var.api_endpoints : tostring(idx) => endpoint }

  source = "../api_endpoints"

  http_method          = each.value.http_method
  search_terms         = each.value.search_terms
  lambda_arn           = each.value.lambda_arn
  lambda_function_name = each.value.lambda_function_name
  path_name            = each.value.path

  rest_api_id         = aws_api_gateway_rest_api.rest_api.id
  gateway_resource_id = aws_api_gateway_resource.rest_api_resource[each.value.path].id
  authorizer_id       = each.value.cognito_authorizer == true ? aws_api_gateway_authorizer.authorizer.id : ""
}

resource "aws_api_gateway_deployment" "rest_api_deployment" {
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  triggers = {
    redeployment = sha1(jsonencode([
      local.api_endpoint_triggers
    ]))
  }
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "rest_api_stage" {
  deployment_id         = aws_api_gateway_deployment.rest_api_deployment.id
  rest_api_id           = aws_api_gateway_rest_api.rest_api.id
  stage_name            = var.rest_api_stage_name
  xray_tracing_enabled  = true
  cache_cluster_enabled = false
  cache_cluster_size    = var.cache_cluster_size

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.stage_logs.arn
    format          = "{\"requestId\":\"$context.requestId\",\"extendedRequestId\":\"$context.extendedRequestId\",\"ip\":\"$context.identity.sourceIp\",\"caller\":\"$context.identity.caller\",\"user\":\"$context.identity.user\",\"requestTime\":\"$context.requestTime\",\"httpMethod\":\"$context.httpMethod\",\"resourcePath\":\"$context.resourcePath\",\"status\":\"$context.status\",\"protocol\":\"$context.protocol\",\"responseLength\":\"$context.responseLength\"}"
  }
}

#tfsec:ignore:aws-api-gateway-enable-cache
resource "aws_api_gateway_method_settings" "all" {
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  stage_name  = aws_api_gateway_stage.rest_api_stage.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled      = true
    logging_level        = "INFO"
    caching_enabled      = false
    cache_data_encrypted = false
  }
}


resource "aws_api_gateway_usage_plan" "rest_api" {
  name = "${var.rest_api_name}-plan"

  api_stages {
    api_id = aws_api_gateway_rest_api.rest_api.id
    stage  = aws_api_gateway_stage.rest_api_stage.stage_name
  }
}

resource "aws_api_gateway_api_key" "rest_api" {
  name = "${var.rest_api_name}-key"
}

resource "aws_api_gateway_usage_plan_key" "rest_api" {
  key_id        = aws_api_gateway_api_key.rest_api.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.rest_api.id
}

resource "aws_api_gateway_authorizer" "authorizer" {
  name          = "tdsa-cognito"
  type          = "COGNITO_USER_POOLS"
  rest_api_id   = aws_api_gateway_rest_api.rest_api.id
  provider_arns = var.cognito_user_pool_arn
}