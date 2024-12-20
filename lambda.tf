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
  source_file = "${path.module}/src/PreSignedURL.js"
  output_path = "${path.module}/PreSignedURL.zip"
}

resource "aws_lambda_function" "PreSignedURL" {
  # tflint-ignore: aws_lambda_function_invalid_runtime
  filename      = data.archive_file.PreSignedURL.output_path
  function_name = "PreSignedURL"
  role          = aws_iam_role.iam_for_lambda.arn
  handler       = "index.handler"

  runtime = "nodejs20.x"
}

data "aws_iam_policy_document" "get_s3_object" {
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${module.ons_upload_ingest_bucket.bucket_arn}/*"]
  }
}

resource "aws_iam_role_policy_attachment" "lambda_s3" {
  role       = aws_iam_role.iam_for_lambda.name
  policy_arn = aws_iam_policy.lambda_s3.arn
}

resource "aws_iam_policy" "lambda_s3" {
  name        = "lambda-policy"
  description = "policy for lambda"
  policy      = data.aws_iam_policy_document.get_s3_object.json
}