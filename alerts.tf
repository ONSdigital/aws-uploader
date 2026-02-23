module "ct-uploader-alerts" {
  source = "git::https://github.com/ONSdigital/aws-alerts?ref=42c092266615d7cfd8a2e9c92c71f38a3559a6e2"

  project_name              = "ctuploader"
  environment               = var.environment
  slack_webhook_security    = local.ct_uploader_slack.security_webhook
  slack_webhook_operational = local.ct_uploader_slack.operational_webhook

  deploy_cost_anomaly_detector = false
}