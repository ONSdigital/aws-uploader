data "archive_file" "maintenance_check" {
  type        = "zip"
  source_file = "${path.module}/src/maintenance-check.js"
  output_path = "${path.module}/.terraform/archive_files/maintenance-check.zip"
}

resource "aws_iam_role" "maintenance_check_edge" {
  provider = aws.useast
  name     = "maintenance-check-edge-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "edgelambda.amazonaws.com"
          ]
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "maintenance_check_edge_basic" {
  provider   = aws.useast
  role       = aws_iam_role.maintenance_check_edge.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "maintenance_check_edge_ssm" {
  provider   = aws.useast
  role       = aws_iam_role.maintenance_check_edge.name
  policy_arn = aws_iam_policy.ssm_read.arn
}


resource "aws_lambda_function" "maintenance_check_edge" {
  #checkov:skip=CKV_AWS_272:Code signing not required for edge function
  #checkov:skip=CKV_AWS_116:DLQ not supported for Lambda@Edge
  #checkov:skip=CKV_AWS_115:Concurrency limits not needed for edge function
  #checkov:skip=CKV_AWS_117:VPC not supported for Lambda@Edge
  #checkov:skip=CKV_AWS_50:X-Ray tracing not supported for Lambda@Edge
  provider         = aws.useast
  filename         = data.archive_file.maintenance_check.output_path
  function_name    = "maintenance-check-edge"
  role             = aws_iam_role.maintenance_check_edge.arn
  handler          = "maintenance-check.handler"
  source_code_hash = data.archive_file.maintenance_check.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 5
  publish          = true
}
