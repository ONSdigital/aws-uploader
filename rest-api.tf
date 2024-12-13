resource "aws_api_gateway_account" "api_gateway_cloudwatch_global" {
  cloudwatch_role_arn = aws_iam_role.cloudwatch_global.arn
}

module "api_gateway" {
  #checkov:skip=CKV2_AWS_51: 
  #checkov:skip=CKV_AWS_120:don't want cache
  #checkov:skip=CKV_AWS_225:don't want cache
  #checkov:skip=CKV_AWS_308:don't want cache
  source = "./modules/rest_api_gateway"

  rest_api_name         = "tdsa_rest_api_gateway"
  vpc_id                = module.vpc.vpc_id
  vpc_endpoint          = aws_vpc_endpoint.api_gateway.id
  cognito_user_pool_arn = [module.tdsa_cognito.user_pool_arn]

  api_endpoints = [
    {
      http_method  = "GET"
      search_terms = ["search_term", "search_type"]
      #   lambda_arn           = module.find_lambda.invoke_arn
      #   lambda_function_name = module.find_lambda.lambda_function_name
      path = "restAPIGateway/triggerlambda"
  }]
}