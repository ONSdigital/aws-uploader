resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for website"
}

resource "aws_cloudfront_origin_access_control" "ons_uploader_cloudfront" {
  name                              = "ons-uploader-cloudfront"
  description                       = "CloudFront Policy for Uploader"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}


resource "aws_cloudfront_distribution" "uploader" {
  #checkov:skip=CKV_AWS_192:testing cloudfront, fix to be implemented
  #checkov:skip=CKV_AWS_31:testing cloudfront, fix to be implemented
  #checkov:skip=CKV_AWS_310:testing cloudfront, fix to be implemented
  #checkov:skip=CKV2_AWS_42:testing cloudfront, fix to be implemented
  #checkov:skip=CKV2_AWS_32:testing cloudfront, fix to be implemented
  #checkov:skip=CKV2_AWS_47:testing cloudfront, fix to be implemented
  origin {
    domain_name              = module.ons_upload_bucket.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.ons_uploader_cloudfront.id
    origin_id                = "S3Origin"

  }
  aliases = ["uploader.${var.domain_name}"]

  enabled             = true
  is_ipv6_enabled     = false                                         #CKV_AWS_68 change to true
  web_acl_id          = aws_wafv2_web_acl.uploader_waf_cloudfront.arn #
  http_version        = "http2and3"
  default_root_object = "council-tax/index.html"
  logging_config { #CKV_AWS_86
    bucket = aws_s3_bucket.cloudfront_logging_bucket.bucket_domain_name
    prefix = "logging"


  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "S3Origin"
    origin_request_policy_id   = "acba4595-bd28-49b8-b9fe-13317c0390fa" # Managed-CORS-CustomOrigin policy ID
    response_headers_policy_id = aws_cloudfront_response_headers_policy.custom_security_headers.id
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    # forwarded_values {
    #   query_string = false

    #   cookies {
    #     forward = "none"
    #   }
    # }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  ordered_cache_behavior {
    path_pattern           = ("council-tax/index.html")
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3Origin"
    viewer_protocol_policy = "redirect-to-https"

    function_association {

      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.rewrite_default_index_request.arn

    }
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "whitelist"
      locations        = ["GB"]
    }
  }


  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.uploader.arn
    minimum_protocol_version = "TLSv1.2_2021"
    ssl_support_method       = "sni-only"
  }

}

resource "aws_cloudfront_response_headers_policy" "custom_security_headers" {
  name    = "csp-security-headers"
  comment = "Security headers including CORS, Security Headers and CSP"

  cors_config {
    access_control_allow_credentials = false

    access_control_allow_headers {
      items = ["Authorization", "Content-Type", "X-Amz-Date", "X-Api-Key", "X-Amz-Security-Token"]
    }

    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS"]
    }

    access_control_allow_origins {
      items = ["*"]
    }

    origin_override = true
  }

  security_headers_config {
    content_security_policy {
      content_security_policy = "default-src 'self'; connect-src 'self' ${aws_apigatewayv2_stage.api.invoke_url}pre-signed-url ${local.s3_domain}; manifest-src 'self' https://cdn.ons.gov.uk; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.ons.gov.uk; style-src 'self' 'unsafe-inline' https://cdn.ons.gov.uk; font-src 'self' https://cdn.ons.gov.uk; img-src 'self' https://cdn.ons.gov.uk data:;"
      override                = true
    }

    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "SAMEORIGIN"
      override     = true
    }

    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
  }
}

resource "aws_cloudfront_function" "rewrite_default_index_request" {
  name    = "RewriteDefaultIndexRequest"
  runtime = "cloudfront-js-2.0"
  comment = "function for using a second index page"
  publish = true
  code    = file("${path.module}/scripts/second_index.js")
}