resource "aws_ssm_parameter" "maintenance_mode" {
  name  = "/cloudfront/maintenance_mode"
  type  = "String"
  value = "false"
}

resource "aws_lambda_function" "maintenance_edge" {
  filename         = "${path.module}/scripts/lambda_edge_maintenance.zip"
  function_name    = "maintenance-edge-handler"
  role             = aws_iam_role.lambda_edge_role.arn
  handler          = "lambda_edge_maintenance.handler"
  source_code_hash = filebase64sha256("${path.module}/scripts/lambda_edge_maintenance.zip")
  runtime          = "nodejs18.x"
  publish          = true
  description      = "Lambda@Edge for CloudFront maintenance mode toggle"
}

resource "aws_iam_role" "lambda_edge_role" {
  name = "lambda_edge_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = ["lambda.amazonaws.com", "edgelambda.amazonaws.com"]
      }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_edge_policy" {
  name = "lambda_edge_policy"
  role = aws_iam_role.lambda_edge_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "s3:GetObject"
        ]
        Resource = "*"
      }
    ]
  })
}
