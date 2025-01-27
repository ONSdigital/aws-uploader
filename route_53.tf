
data "aws_route53_zone" "domain" {
  name = var.domain_name
}

resource "aws_route53_record" "uploader" {
  zone_id = data.aws_route53_zone.domain.zone_id
  name    = local.website_address
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.uploader.domain_name
    zone_id                = aws_cloudfront_distribution.uploader.hosted_zone_id
    evaluate_target_health = false
  }
}
