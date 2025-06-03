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


# Onboarding of new councils is done by adding a new entry to the locals block and a new resource block
# Please keep these sorted alphanumerically by LAD code - makes it easier to find existing councils ands onboard new councils
locals {
  E00000000-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Test"
    lad_code     = "E00000000"
  })

  E12345678-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax"
    lad_code     = "E12345678"
  })

  E06000012-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - North East Lincolnshire"
    lad_code     = "E06000012"
  })

  E06000013-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - North Lincolnshire"
    lad_code     = "E06000013"
  })

  E07000081-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Gloucester"
    lad_code     = "E07000081"
  })

  E07000112-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Shepway (Folkstone-Hythe)"
    lad_code     = "E07000112"
  })

  E07000127-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - West Lancashire"
    lad_code     = "E07000127"
  })

  E07000175-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Newark & Sherwood"
    lad_code     = "E07000175"
  })

  E07000084-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Basingstoke & Deane"
    lad_code     = "E07000084"
  })

  E07000202-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Ipswich"
    lad_code     = "E07000202"
  })

  E07000039-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - South Derbyshire"
    lad_code     = "E07000039"
  })

  E07000133-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Melton"
    lad_code     = "E07000133"
  })

  E07000194-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Lichfield"
    lad_code     = "E07000194"
  })

  E08000034-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Kirklees"
    lad_code     = "E08000034"
  })

  E08000035-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Leeds"
    lad_code     = "E08000035"
  })

  E08000002-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - BURY"
    lad_code     = "E08000002"
  })

  E09000023-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Lewisham"
    lad_code     = "E09000023"
  })

  E09000028-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Southwark"
    lad_code     = "E09000028"
  })

  W06000014-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Vale Of Glamorgan"
    lad_code     = "W06000014"
  })

  W06000020-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Torfaen"
    lad_code     = "W06000020"
  })

  W06000021-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Monmouthshire"
    lad_code     = "W06000021"
  })

  W06000024-council-rendered-html = templatefile("${path.module}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - Merthyr Tydfil"
    lad_code     = "W06000024"
  })
}

resource "aws_s3_object" "test" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E00000000-Test&Test.html"
  source_hash  = md5(local.E00000000-council-rendered-html)
  content      = local.E00000000-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "_012345678-council" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E12345678-council.html"
  source_hash  = md5(local.E12345678-council-rendered-html)
  content      = local.E12345678-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "North-East-Lincolnshire" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E06000012-North-East-Lincolnshire.html"
  source_hash  = md5(local.E06000012-council-rendered-html)
  content      = local.E06000012-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "North-Lincolnshire" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E06000013-North-Lincolnshire.html"
  source_hash  = md5(local.E06000013-council-rendered-html)
  content      = local.E06000013-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "basingstoke-deane" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E07000084-Basingstoke&Deane.html"
  source_hash  = md5(local.E07000084-council-rendered-html)
  content      = local.E07000084-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "ipswich" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E07000202-Ipswich.html"
  source_hash  = md5(local.E07000202-council-rendered-html)
  content      = local.E07000202-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "south-derbyshire" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E07000039-South-Derbyshire.html"
  source_hash  = md5(local.E07000039-council-rendered-html)
  content      = local.E07000039-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "melton" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E07000133-Melton.html"
  source_hash  = md5(local.E07000133-council-rendered-html)
  content      = local.E07000133-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "lichfield" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E07000194-Lichfield.html"
  source_hash  = md5(local.E07000194-council-rendered-html)
  content      = local.E07000194-council-rendered-html
  content_type = "text/html"
}
resource "aws_s3_object" "gloucester" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E07000081-Gloucester.html"
  source_hash  = md5(local.E07000081-council-rendered-html)
  content      = local.E07000081-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "shepway-folkstone-hythe" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E07000112-Shepway(Folkstone-Hythe).html"
  source_hash  = md5(local.E07000112-council-rendered-html)
  content      = local.E07000112-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "west-lancashire" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E07000127-West-Lancashire.html"
  source_hash  = md5(local.E07000127-council-rendered-html)
  content      = local.E07000127-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "newark-sherwood" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E07000175-Newark&Sherwood.html"
  source_hash  = md5(local.E07000175-council-rendered-html)
  content      = local.E07000175-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "kirklees" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E08000034-Kirklees.html"
  source_hash  = md5(local.E08000034-council-rendered-html)
  content      = local.E08000034-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "Leeds" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E08000035-Leeds.html"
  source_hash  = md5(local.E08000035-council-rendered-html)
  content      = local.E08000035-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "bury" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E08000002-BURY.html"
  source_hash  = md5(local.E08000002-council-rendered-html)
  content      = local.E08000002-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "Lewisham" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E09000023-Lewisham.html"
  source_hash  = md5(local.E09000023-council-rendered-html)
  content      = local.E09000023-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "southwark" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E09000028-southwark.html"
  source_hash  = md5(local.E09000028-council-rendered-html)
  content      = local.E09000028-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "torfaen" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/W06000020-Torfaen.html"
  source_hash  = md5(local.W06000020-council-rendered-html)
  content      = local.W06000020-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "monmouthshire" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/W06000021-Monmouthshire.html"
  source_hash  = md5(local.W06000021-council-rendered-html)
  content      = local.W06000021-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "vale-of-glamorgan" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/W06000014-Vale-Of-Glamorgan.html"
  source_hash  = md5(local.W06000014-council-rendered-html)
  content      = local.W06000014-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "merthyr-tydfil" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/W06000024-Merthyr-Tydfil.html"
  source_hash  = md5(local.W06000024-council-rendered-html)
  content      = local.W06000024-council-rendered-html
  content_type = "text/html"
}