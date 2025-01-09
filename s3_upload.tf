module "ons_upload_ingest_bucket" {
  #checkov:skip=CKV_TF_1:using versioning instead of git commit hashes
  source      = "git::https://github.com/ONSdigital/aws-s3-bucket.git?ref=v6.1.0"
  bucket_name = var.upload_ingest_bucket_name
  versioning  = true
  tiering     = false
  logging     = false

  attach_secure_transport_policy = false

}

resource "aws_s3_bucket_policy" "ons_upload_policy" {
  bucket = module.ons_upload_bucket.bucket_id

  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Sid" : "AllowCloudFrontServicePrincipalReadOnly",
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "cloudfront.amazonaws.com"
        },
        "Action" : "s3:GetObject",
        "Resource" : "arn:aws:s3:::aws-uploader-ost-dev/*",
        "Condition" : {
          "StringEquals" : {
            "AWS:SourceArn" : "arn:aws:cloudfront::055232432732:distribution/E28DWVPYYHYB4P"
          }
        }
      }
    ]
  })
}

data "aws_iam_policy_document" "uploader_bucket" {
  statement {
    effect = "Allow"

    actions   = ["s3:GetObject"]
    resources = ["${module.ons_upload_bucket.bucket_arn}/*"]

    principals {
      type = "AWS"
      identifiers = [
        "cloudfront.amazonaws.com"
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = ["arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.ons_uploader.id}"]
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
  bucket = module.ons_upload_bucket.bucket_arn
  policy = data.aws_iam_policy_document.uploader_bucket.json
}
