data "aws_iam_policy_document" "lambda_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "iam_for_lambda" {
  name               = "iam_for_lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_role.json
}

data "archive_file" "PreSignedURL" {
  type        = "zip"
  source_file = "${path.module}/src/PreSignedURL.mjs"
  output_path = "${path.module}/PreSignedURL.zip"
}


resource "aws_lambda_function" "PreSignedURL" {
  #checkov:skip=CKV_AWS_173: we are using AWS encryption keys
  #checkov:skip=CKV_AWS_115: concurrent execution limit
  #checkov:skip=CKV_AWS_116: Ensure that AWS Lambda function is configured for a Dead Letter Queue(DLQ)
  #checkov:skip=CKV_AWS_117: no vpc architecture
  #checkov:skip=CKV_AWS_272: code signing not required
  filename         = data.archive_file.PreSignedURL.output_path
  function_name    = var.lambda_PreSignedURL_function
  role             = aws_iam_role.iam_for_lambda.arn
  handler          = "PreSignedURL.handler"
  source_code_hash = data.archive_file.PreSignedURL.output_base64sha256
  # tflint-ignore: aws_lambda_function_invalid_runtime
  runtime = "nodejs20.x"
  timeout = 30

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      BUCKET_NAME = module.ons_upload_ingest_bucket.bucket_id
    }
  }
}

data "aws_iam_policy_document" "get_s3_object" {
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${module.ons_upload_ingest_bucket.bucket_arn}/*"]
  }
}

resource "aws_iam_role_policy_attachment" "lambda_s3" {
  role       = aws_iam_role.iam_for_lambda.name
  policy_arn = aws_iam_policy.lambda_s3.arn
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.iam_for_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "lambda_s3" {
  name        = "lambda-policy"
  description = "policy for lambda"
  policy      = data.aws_iam_policy_document.get_s3_object.json
}
