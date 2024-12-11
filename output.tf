# Add in any variables you which to export or be made available from your terraform here.

#Example of exporting a non sensitive value
output "website_domain" {
  value       = aws_cloudfront_distribution.s3_distribution.domain_name
  description = "domain name for the cloudfront website"
}