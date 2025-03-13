#tfsec:ignore:aws-s3-enable-bucket-logging
#tfsec:ignore:aws-s3-enable-versioning
module "ons_upload_bucket" {
  #checkov:skip=CKV_TF_1:using versioning instead of git commit hashes
  source      = "git::https://github.com/ONSdigital/aws-s3-bucket.git?ref=v7.4.0"
  bucket_name = var.upload_host_bucket_name
  versioning  = true
  tiering     = false
  logging     = false

  attach_secure_transport_policy           = false
  attach_deny_incorrect_encryption_headers = false

}

data "aws_iam_policy_document" "uploader_bucket" {
  statement {
    effect = "Allow"

    actions   = ["s3:GetObject"]
    resources = ["${module.ons_upload_bucket.bucket_arn}/*"]

    principals {
      type = "Service"
      identifiers = [
        "cloudfront.amazonaws.com"
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = ["arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.uploader.id}"]
    }
  }
  statement {
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [module.ons_upload_bucket.bucket_arn,
      "${module.ons_upload_bucket.bucket_arn}/*"
    ]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}


locals {
  E12345678-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax"
    lad_code     = "E12345678"
  })

  E07000175-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Newark & Sherwood"
    lad_code     = "E07000175"
  })

  E02000346-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Example 1" # "Council Tax - Gloucester"
    lad_code     = "E02000346" # "E07000081"
  })

  E04000143-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Example 2" # "Council Tax - Kirklees"
    lad_code     = "E04000143" # "E08000034"
  })

 E06000682-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Example 3" # "Council Tax - Shepway (Folkstone-Hythe)"
    lad_code     = "E06000682" # "W07000112"
  })

 E01000713-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Example 4" # "Council Tax - Merthyr Tydfil"
    lad_code     = "E01000713" # "W06000024"
  })

 E08000546-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Example 5" # "Council Tax - Monmouthshire"
    lad_code     = "E08000546" # "W06000021"
  })
 
#  W06000020-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
#     council_name = "Council Tax - Torfaen"
#     lad_code     = "W06000020" 
#   })

#  W06000014-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
#     council_name = "Council Tax - Vale Of Glamorgan"
#     lad_code     = "W06000014" 
#   })
}
resource "aws_s3_bucket_policy" "uploader_bucket" {
  bucket = module.ons_upload_bucket.bucket_id
  policy = data.aws_iam_policy_document.uploader_bucket.json
}

resource "aws_s3_bucket_website_configuration" "ons_upload_configuration" {
  bucket = module.ons_upload_bucket.bucket_id

  index_document {
    suffix = "index.html"
  }
}

resource "aws_s3_object" "home_page" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "index.html"
  source       = "${path.module}/scripts/index.html"
  source_hash  = filemd5("${path.module}/scripts/index.html")
  content_type = "text/html"
}

resource "aws_s3_object" "council_home_page" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/index.html"
  source       = "${path.module}/scripts/council-tax/index.html"
  source_hash  = filemd5("${path.module}/scripts/council-tax/index.html")
  content_type = "text/html"
}

resource "aws_s3_object" "_012345678-council" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E12345678-council.html"
  source_hash  = md5(local.E12345678-council-rendered-html)
  content      = local.E12345678-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "newark-sherwood" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E07000175-Newark&Sherwood.html"
  source_hash  = md5(local.E07000175-council-rendered-html)
  content      = local.E07000175-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "council-example-1" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E02000346-Council-Example-1.html"
  source_hash  = md5(local.E02000346-council-rendered-html)
  content      = local.E02000346-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "council-example-2" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E04000143-Council-Example-2.html"
  source_hash  = md5(local.E04000143-council-rendered-html)
  content      = local.E04000143-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "council-example-3" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E06000682-Council-Example-3.html"
  source_hash  = md5(local.E06000682-council-rendered-html)
  content      = local.E06000682-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "council-example-4" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E01000713-Council-Example-4.html"
  source_hash  = md5(local.E01000713-council-rendered-html)
  content      = local.E01000713-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "council-example-5" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E08000546-Council-Example-5.html"
  source_hash  = md5(local.E08000546-council-rendered-html)
  content      = local.E08000546-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "success_page" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/success.html"
  source       = "${path.module}/scripts/success.html"
  source_hash  = filemd5("${path.module}/scripts/success.html")
  content_type = "text/html"
}

resource "aws_s3_object" "file_submission" {
  bucket = module.ons_upload_bucket.bucket_id
  key    = "council-tax/file_submission.js"
  content = templatefile("${path.module}/scripts/file_submission.js", {
    api_url = aws_apigatewayv2_stage.api.invoke_url
  })
  content_type = "text/javascript"
}

resource "aws_s3_object" "result_message" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/result_message.js"
  source       = "${path.module}/scripts/result_message.js"
  source_hash  = filemd5("${path.module}/scripts/result_message.js")
  content_type = "text/javascript"
}
