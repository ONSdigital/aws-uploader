resource "aws_acm_certificate" "uploader" {
  provider          = aws.useast
  domain_name       = local.website_address
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  allow_overwrite = true
  name            = tolist(aws_acm_certificate.uploader.domain_validation_options)[0].resource_record_name
  records         = [tolist(aws_acm_certificate.uploader.domain_validation_options)[0].resource_record_value]
  type            = tolist(aws_acm_certificate.uploader.domain_validation_options)[0].resource_record_type
  zone_id         = data.aws_route53_zone.domain.id
  ttl             = 60
}


resource "aws_acm_certificate_validation" "cert" {
  provider                = aws.useast
  certificate_arn         = aws_acm_certificate.uploader.arn
  validation_record_fqdns = [aws_route53_record.cert_validation.fqdn]
}