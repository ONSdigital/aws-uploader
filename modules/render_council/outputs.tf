output "hash" {
  value       = aws_s3_object.council-rendered.source_hash
  description = "The MD5 hash of the rendered HTML for the council page"
}
