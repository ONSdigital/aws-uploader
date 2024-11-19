# Remote State setup

To create an inital backend state infastructure for the main terraform module. Random string used as S3 buckets and Dynamo DBs need to be globally unique. This resource should only need to run for an inital setup.

### Resources created

- S3 bucket with:
  - verisoning
  - server side encryption enables
- Dynamo DB for handling terraform lock files

### Outputs

- S3 arn name (s3_name) - arn resource for the s3 bucket including the name of the s3 bucket created. 


# Getting started

Install aws-cli

```
brew install awscli
```

Authenticate with AWS

```
export AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="eu-west-2"
```

cd into the remote-state directory

```
cd remote-state
```

run terraform init

```
terraform init
```

Run terraform plan

```
terraform plan
```

run terraform apply

```
terraform apply
```

<!-- BEGINNING OF PRE-COMMIT-TERRAFORM DOCS HOOK -->
## Requirements

| Name | Version |
|------|---------|
| <a name="requirement_terraform"></a> [terraform](#requirement\_terraform) | >= 1.1.4 |
| <a name="requirement_aws"></a> [aws](#requirement\_aws) | ~> 3.0 |

## Providers

| Name | Version |
|------|---------|
| <a name="provider_aws"></a> [aws](#provider\_aws) | 3.75.1 |
| <a name="provider_random"></a> [random](#provider\_random) | 3.1.3 |

## Modules

No modules.

## Resources

| Name | Type |
|------|------|
| [aws_dynamodb_table.terraform_locks](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/dynamodb_table) | resource |
| [aws_s3_bucket.terraform_state](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket) | resource |
| [aws_s3_bucket_acl.terraform_state](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_acl) | resource |
| [aws_s3_bucket_server_side_encryption_configuration.terraform_state](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_server_side_encryption_configuration) | resource |
| [aws_s3_bucket_versioning.terraform_state_versioning](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_versioning) | resource |
| [random_string.random](https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/string) | resource |

## Inputs

No inputs.

## Outputs

| Name | Description |
|------|-------------|
| <a name="output_s3_name"></a> [s3\_name](#output\_s3\_name) | n/a |
<!-- END OF PRE-COMMIT-TERRAFORM DOCS HOOK -->
