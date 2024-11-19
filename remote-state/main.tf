terraform {
  required_version = ">= 1.3.1"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.18.0"
    }
  }
}

provider "aws" {
  region = "eu-west-2"
}


resource "random_string" "random" {
  length  = 4
  lower   = true
  special = false
  numeric = false
  upper   = false
}
