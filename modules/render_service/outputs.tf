output "hash" {
  value       = aws_s3_object.service-rendered.source_hash
  description = "The MD5 hash of the rendered HTML for the service page."
}

output "key" {
  value       = aws_s3_object.service-rendered.key
  description = "The S3 key of the rendered page."
}
