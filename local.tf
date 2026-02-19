locals {
  website_address = "uploader.${var.domain_name}"
  s3_domain       = "https://${module.ons_upload_ingest_bucket.bucket_id}.s3.${data.aws_region.current.name}.amazonaws.com"
}

# alerting webhook
data "aws_secretsmanager_secret" "secretsmanager_secret_ct_uploader_slack" {
  name = "ct_uploader_slack"
}

data "aws_secretsmanager_secret_version" "secretsmanager_secret_version_ct_uploader_slack" {
  secret_id = data.aws_secretsmanager_secret.secretsmanager_secret_ct_uploader_slack.id
}

locals {
  ct_uploader_slack = jsondecode(
    data.aws_secretsmanager_secret_version.secretsmanager_secret_version_ct_uploader_slack.secret_string
  )
}