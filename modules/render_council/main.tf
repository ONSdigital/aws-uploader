  locals {
  rendered-html=  templatefile("${path.root}/scripts/template/council-tax-template.html", {
    council_name = "Council Tax - ${var.council_name}"
    lad_code     = var.lad_code
  })
  }
/*   resource "aws_s3_object" "test" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E00000000-Test&Test.html"
  source_hash  = md5(local.E00000000-council-rendered-html)
  content      = local.E00000000-council-rendered-html
  content_type = "text/html"
}

resource "aws_s3_object" "North-East-Lincolnshire" {
  bucket       = module.ons_upload_bucket.bucket_id
  key          = "council-tax/E06000012-North-East-Lincolnshire.html"
  source_hash  = md5(local.E06000012-council-rendered-html)
  content      = local.E06000012-council-rendered-html
  content_type = "text/html"
}
 */


resource "aws_s3_object" "council-rendered" {
  bucket       = var.bucket-id
  key          = "council-tax/${var.lad_code}-${urlencode(var.council_name)}.html"
  source_hash  = md5(local.rendered-html)
  content      = local.rendered-html
  content_type = "text/html"
}
