#tfsec:ignore:aws-dynamodb-enable-at-rest-encryption
#tfsec:ignore:aws-dynamodb-enable-recovery
#tfsec:ignore:aws-dynamodb-table-customer-key
resource "aws_dynamodb_table" "terraform_locks" {
  name = "tf-state-${random_string.random.id}-locks"
  #checkov:skip=CKV_AWS_28:no backups needed
  #checkov:skip=CKV_AWS_119: no CMK needed for lock table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
}
