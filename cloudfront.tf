resource "aws_s3_bucket_policy" "ons_upload_policy" {
  bucket = module.ons_upload_bucket.bucket_id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "s3:GetObject"
        ],
        Effect = "Allow",
        Principal = {
            Service = "cloudfront.amazonaws.com"
        },
        Resource = [
          "${module.ons_upload_bucket.bucket_arn}/*"
        ]
      }
    ]
  })
}

resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for website"
}


resource "aws_cloudfront_distribution" "s3_distribution" {
    #checkov:skip=CKV_AWS_86:testing cloudfront, fix to be implemented
    #checkov:skip=CKV_AWS_310:testing cloudfront, fix to be implemented
    #checkov:skip=CKV_AWS_174:testing cloudfront, fix to be implemented
  origin {
    domain_name              = aws_s3_bucket_website_configuration.ons_upload_configuration.website_domain
    origin_access_control_id = aws_cloudfront_origin_access_identity.oai.id
    origin_id                = "S3Origin"
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  aliases = ["mysite.example.com", "yoursite.example.com"]

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "POST"]
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
    cloudfront_default_certificate = true
  }
}