output "s3_name" {
  value = aws_s3_bucket.terraform_state.id
}

output "dynamo_db_name" {
  value = aws_dynamodb_table.terraform_locks.name
}
