module "ct-uploader-alerts" {
  source = "git::https://github.com/ONSdigital/aws-alerts?ref=1.3.13"

  project_name              = "uploader"
  environment               = var.environment
  slack_webhook_security    = local.ct_uploader_slack.security_webhook
  slack_webhook_operational = local.ct_uploader_slack.operational_webhook

  deploy_cost_anomaly_detector = false
}