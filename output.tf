output "website_domain" {
  value       = aws_cloudfront_distribution.uploader.domain_name
  description = "domain name for the cloudfront website"
}
