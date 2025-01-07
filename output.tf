output "website_domain" {
  value       = aws_cloudfront_distribution.s3_distribution.domain_name
  description = "domain name for the cloudfront website"
}
