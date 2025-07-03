terraform {
  #update the version of terraform as required
  required_version = ">= 1.8.0"
  #initialise a backend configuration for terraform to save the state file. Do not use local state files.
  backend "s3" {
  }
  #Add in all required providers needed to run the terraform you are using.
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.94.1, <= 6.0.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.7.0"
    }
    null = {
      source  = "hashicorp/null"
      version = ">= 3.2.0"
    }
    # local = {
    #   source  = "hashicorp/local"
    #   version = ">= 2.1.0"
    # }
  }
}

provider "aws" {
  #Add a default region for your deployments, this should be a variable in the variables.tf file with a default value.
  region = var.region
  assume_role {
    role_arn     = "arn:aws:iam::${var.target_account_id}:role/aws_shared_concourse"
    session_name = "concourse-deployment-session"
  }
  # Add default tags for your project, any resource which accepts tags will automatically have the below tags added to them.
  default_tags {
    tags = {
      Project   = "ons-uploader",
      Terraform = "True"
    }
  }
}


provider "aws" {
  #Add a default region for your deployments, this should be a variable in the variables.tf file with a default value.
  alias  = "useast"
  region = "us-east-1"

  assume_role {
    role_arn     = "arn:aws:iam::${var.target_account_id}:role/aws_shared_concourse"
    session_name = "concourse-deployment-session"
  }
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}
