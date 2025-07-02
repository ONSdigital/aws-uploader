output "s3_name" {
  value       = aws_s3_bucket.terraform_state.id
  description = "The name of the S3 bucket used for storing Terraform state files."
}

output "dynamo_db_name" {
  value       = aws_dynamodb_table.terraform_locks.name
  description = "The name of the DynamoDB table used for storing Terraform state locks."
}
