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
  source_file = "${path.module}/src/PreSignedURL.py"
  output_path = "${path.module}/PreSignedURL.zip"
}

resource "aws_lambda_function" "rclone-delete-task-lambda" {
  filename      = data.archive_file.PreSignedURL.output_path
  function_name = "PreSignedURL"
  role          = aws_iam_role.iam_for_lambda.arn
  handler       = "lambda_function.lambda_handler"

}