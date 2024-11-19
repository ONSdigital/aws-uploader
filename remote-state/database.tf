resource "aws_dynamodb_table" "terraform_locks" {
  name         = "tf-state-${random_string.random.id}-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
}
