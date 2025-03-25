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

  E07000081-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Gloucester"
    lad_code     = "E07000081"
  })

  E08000034-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Kirklees"
    lad_code     = "E08000034"
  })

  E07000112-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Shepway (Folkstone-Hythe)"
    lad_code     = "E07000112"
  })

  W06000024-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Merthyr Tydfil"
    lad_code     = "W06000024"
  })

  W06000021-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Monmouthshire"
    lad_code     = "W06000021"
  })

  W06000020-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Torfaen"
    lad_code     = "W06000020"
  })

  W06000014-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Vale Of Glamorgan"
    lad_code     = "W06000014"
  })
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

resource "aws_s3_object" "gloucester" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E07000081-Gloucester.html"
  source_hash  = md5(local.E07000081-council-rendered-html)
  content      = local.E07000081-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "kirklees" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E08000034-Kirklees.html"
  source_hash  = md5(local.E08000034-council-rendered-html)
  content      = local.E08000034-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "shepway-folkstone-hythe" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E07000112-Shepway(Folkstone-Hythe).html"
  source_hash  = md5(local.E07000112-council-rendered-html)
  content      = local.E07000112-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "merthyr-tydfil" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/W06000024-Merthyr-Tydfil.html"
  source_hash  = md5(local.W06000024-council-rendered-html)
  content      = local.W06000024-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "monmouthshire" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/W06000021-Monmouthshire.html"
  source_hash  = md5(local.W06000021-council-rendered-html)
  content      = local.W06000021-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "torfaen" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/W06000020-Torfaen.html"
  source_hash  = md5(local.W06000020-council-rendered-html)
  content      = local.W06000020-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "vale-of-glamorgan" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/W06000014-Vale-Of-Glamorgan.html"
  source_hash  = md5(local.W06000014-council-rendered-html)
  content      = local.W06000014-council-rendered-html
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
