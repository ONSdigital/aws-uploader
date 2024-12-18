# AWS Uploader
This solution hosts the infrastructure to build a website that allows specific users to upload EXTRACT and MANI files inside a secured S3 bucket and deploy it into
dev, pre-prod and production environments.
This template is designed to help you start an AWS terraform repository in the same structure across all projects. 

The solution deploys:

		○ Host S3 Bucket: With enabled static website hosting and the appropriate permissions
		○ CloudFront Distribution: Linked to the Host S3 Bucket
		○ IAM Roles and Policies
		○ HTML Scripts: All html pages that will be hosted inside the S3 Bucket 
		○ Lambda Script: Create "PreSignedURL" script that will be targeting the Ingest Bucket
		○ Ingest S3 Bucket: Creating the ingest bucket where the files will be uploaded and set the appropriate permissions
		○ Set up Route 53 DNS: Generates unique URL for each council



# Pre Commits

This repository makes use of https://github.com/gruntwork-io/pre-commit to help enforce code quality. 
Useful guide https://medium.com/slalom-build/pre-commit-hooks-for-terraform-9356ee6db882

## Prerequisites

You will need to install the following:

- [Pre Commit](https://github.com/gruntwork-io/pre-commit) -
`brew install pre-commit`
- [Terraform](https://learn.hashicorp.com/tutorials/terraform/install-cli) - `brew tap hashicorp/tap`, 
              `brew install hashicorp/tap/terraform`
- [TFSec](https://github.com/aquasecurity/tfsec) - `brew install tfsec`
- [Terraform Docs](https://terraform-docs.io/user-guide/installation/) - `brew install terraform-docs`
- [Pre Commit Hooks](https://github.com/pre-commit/pre-commit-hooks) - `pip install pre-commit-hooks`
- [Tflint](https://github.com/terraform-linters/tflint) - `brew install tflint`

## Usage

Once you have met all the prerequisites install pre commit on the reposiotry 

```
pre-commit install
```

Configuration for the pre commit can be found in .pre-commit-config.yaml

Pre commit is doing:
- terraform-validate - ensuring any terraform code which is being committed is valid
- terraform fmt - formatting any terraform which is being committed. 
- terraform-docs - Used to automatically generate documentation for this repo
- Tflint - Finds invalid configuration with AWS Terraform, enforces agreed apon best practices, warns about deprecated syntax
- Tfsec - Checks for misconfigurations in terraform code against security protocols
- Git checks - checks for large files being commited, merge conflicts, end of file fixes, checks for any potential secrets being committed.


## Terraform

Only use this method for testing locally, all deployments should go through your CICD pipeline.

### Authenticate with AWS

Log into AWS and select the account required. Select Command line and programmatic access and select option 1.

```
export AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="eu-west-2"
export S3_BUCKET_NAME="YOUR_BUCKET_NAME"
```

Terraform init 

```
terraform init -backend-config=bucket="${S3_BUCKET_NAME}"
-backend-config=key="tfstate/default.tfstate"
-backend-config=dynamodb_table="lockstable"
-backend-config=region="eu-west-2"
```

Run terraform plan 

```
terraform plan -var-file=env/env.tfvars
```

## Github Automatic reviewers

The template is setup to use codeowners, this is setup within the `.github` folder within the `CODEOWNERS` file. By default it is set to the CIA team, to update this change or add another github team.

## Dependabot

Dependabot is setup to check dependency versions within terraform, this will automatically open a PR every Monday for any providers which are out of date.

## CICD

Concourse uses YAML to create the pipelines, which is works well until you start to create bigger pipelines to support bigger environments. 
Within the `ci` folder there are two examples `aviator` and `concourse`. Read the README in both sections to work out which is better for your usecase. 

<!-- BEGIN_TF_DOCS -->
## Requirements

| Name | Version |
|------|---------|
| <a name="requirement_terraform"></a> [terraform](#requirement\_terraform) | >= 1.8.0 |
| <a name="requirement_aws"></a> [aws](#requirement\_aws) | ~> 5.76.0 |

## Providers

| Name | Version |
|------|---------|
| <a name="provider_aws"></a> [aws](#provider\_aws) | 5.76.0 |

## Modules

| Name | Source | Version |
|------|--------|---------|
| <a name="module_api_gateway"></a> [api\_gateway](#module\_api\_gateway) | ./modules/rest_api_gateway | n/a |
| <a name="module_ons_upload_bucket"></a> [ons\_upload\_bucket](#module\_ons\_upload\_bucket) | git::https://github.com/ONSdigital/aws-s3-bucket.git | v6.1.0 |
| <a name="module_ons_upload_ingest_bucket"></a> [ons\_upload\_ingest\_bucket](#module\_ons\_upload\_ingest\_bucket) | git::https://github.com/ONSdigital/aws-s3-bucket.git | v6.1.0 |

## Resources

| Name | Type |
|------|------|
| [aws_api_gateway_account.api_gateway_cloudwatch_global](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/api_gateway_account) | resource |
| [aws_cloudfront_distribution.s3_distribution](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudfront_distribution) | resource |
| [aws_cloudfront_origin_access_control.cloudfront](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudfront_origin_access_control) | resource |
| [aws_cloudfront_origin_access_identity.oai](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudfront_origin_access_identity) | resource |
| [aws_s3_bucket_policy.ons_upload_policy](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_policy) | resource |
| [aws_s3_bucket_website_configuration.ons_upload_configuration](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_website_configuration) | resource |
| [aws_s3_object.council_tax_folder](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_object) | resource |
| [aws_s3_object.error_page](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_object) | resource |
| [aws_s3_object.file_names_dont_match_page](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_object) | resource |
| [aws_s3_object.home_page](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_object) | resource |
| [aws_s3_object.not_csv_page](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_object) | resource |
| [aws_s3_object.success_page](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_object) | resource |
| [aws_wafv2_web_acl.waf_cloudfront](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/wafv2_web_acl) | resource |
| [aws_s3_bucket.ingest_bucket](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/s3_bucket) | data source |
| [aws_s3_bucket.upload_bucket](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/s3_bucket) | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_region"></a> [region](#input\_region) | Region in which to create resources | `string` | `"eu-west-2"` | no |
| <a name="input_upload_host_bucket_name"></a> [upload\_host\_bucket\_name](#input\_upload\_host\_bucket\_name) | Hosting the html for ONS Uploader webapp | `string` | n/a | yes |
| <a name="input_upload_ingest_bucket_name"></a> [upload\_ingest\_bucket\_name](#input\_upload\_ingest\_bucket\_name) | Bucket for ingesting files | `string` | n/a | yes |

## Outputs

| Name | Description |
|------|-------------|
| <a name="output_website_domain"></a> [website\_domain](#output\_website\_domain) | domain name for the cloudfront website |
<!-- END_TF_DOCS -->
