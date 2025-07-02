terraform {
  #update the version of terraform as required
  required_version = ">= 1.8.0"

  #Add in all required providers needed to run the terraform you are using.
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.94.1"
    }

  }
}

locals {
  rendered-html = templatefile(var.template_path, {
    council_name = "Council Tax - ${var.council_name}"
    lad_code     = var.lad_code
  })
  #remove special characters from council name
  #replace spaces with dashes in council name
  clean-council-name2 = replace(replace(var.council_name, "/ *([^A-Za-z0-9-_ ]) */", "$1"), " ", "-")
  council-filename    = "${var.lad_code}-${local.clean-council-name2}.html"
}


resource "aws_s3_object" "council-rendered" {
  bucket       = var.bucket-id
  key          = "council-tax/${local.council-filename}"
  source_hash  = md5(local.rendered-html)
  content      = local.rendered-html
  content_type = "text/html"
}
