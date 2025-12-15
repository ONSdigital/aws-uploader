resource "aws_ssm_parameter" "maintenance_mode" {
  name  = "/uploader/maintenance-mode"
  type  = "String"
  value = "false"

  lifecycle {
    ignore_changes = [value]
  }
}

data "aws_iam_policy_document" "ssm_read" {
  statement {
    effect    = "Allow"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.maintenance_mode.arn]
  }
}

resource "aws_iam_policy" "ssm_read" {
  name   = "uploader-ssm-read"
  policy = data.aws_iam_policy_document.ssm_read.json
}

resource "aws_iam_role_policy_attachment" "lambda_ssm" {
  role       = aws_iam_role.PreSignedURL_role.name
  policy_arn = aws_iam_policy.ssm_read.arn
}
