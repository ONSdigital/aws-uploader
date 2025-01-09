resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for website"
}

resource "aws_cloudfront_origin_access_control" "cloudfront" {
  name                              = "cloudfront"
  description                       = "CloudFront Policy"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}


resource "aws_cloudfront_distribution" "s3_distribution" {
  #checkov:skip=CKV_AWS_192:testing cloudfront, fix to be implemented
  #checkov:skip=CKV_AWS_31:testing cloudfront, fix to be implemented
  #checkov:skip=CKV_AWS_310:testing cloudfront, fix to be implemented
  #checkov:skip=CKV2_AWS_42:testing cloudfront, fix to be implemented
  #checkov:skip=CKV2_AWS_32:testing cloudfront, fix to be implemented
  #checkov:skip=CKV2_AWS_47:testing cloudfront, fix to be implemented
  origin {
    domain_name              = data.aws_s3_bucket.upload_bucket.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.cloudfront.id
    origin_id                = "S3Origin"

  }
  aliases = ["uploader.${var.domain_name}"]

  enabled         = true
  is_ipv6_enabled = false                                #CKV_AWS_68 change to true
  web_acl_id      = aws_wafv2_web_acl.waf_cloudfront.arn #

  default_root_object = "council-tax/"
  logging_config { #CKV_AWS_86
    bucket = aws_s3_bucket.cloudfront_logging_bucket.bucket_domain_name
    prefix = "logging"


  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3Origin"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
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
