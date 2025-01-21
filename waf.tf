resource "aws_wafv2_web_acl" "waf_cloudfront" {
  #checkov:skip=CKV_AWS_192:testing cloudfront, fix to be implemented
  #checkov:skip=CKV_AWS_31:testing cloudfront, fix to be implemented
  #checkov:skip=CKV2_AWS_31:testing cloudfront, fix to be implemented
  provider    = aws.useast
  name        = "waf-cloudfront"
  description = "waf for cloudfront"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # association_config {
  #   request_body {
  #     api_gateway {
  #       default_size_inspection_limit = "KB_16"
  #     }
  #   }
  # }

  rule {
    name     = "AWS-AWSManagedRulesAmazonIpReputationList"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWS-AWSManagedRulesAmazonIpReputationList"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSCommonRuleSet"
    priority = 2

    override_action {
      count {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        rule_action_override {
          action_to_use {
            count {}
          }

          name = "SizeRestrictions_QUERYSTRING"
        }


        rule_action_override {
          action_to_use {
            count {}
          }

          name = "NoUserAgent_HEADER"
        }

      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSCommonRuleSet-waf"
      sampled_requests_enabled   = true
    }
  }

    rule {
    name     = "GBGeoMatch"
    priority = 3

    action {
      allow {}
    }

    statement {
          geo_match_statement {
            country_codes = ["GB"]
          
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GEOMatch-waf"
      sampled_requests_enabled   = true
    }
  }
rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSet"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "waf-cloudfront"
    sampled_requests_enabled   = true
  }
}
 