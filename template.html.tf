# data "template_file" "templating_html" {
#     template = file ("${path.module}/scripts/E12345678-council.html")
#     vars = {
#         page_title = "Council Taxes"
#     }
# }
# output "rendered_html" {
#     value = templatefile("${path.module}/scripts/E12345678-council.html", {
#         page_title = "Council Taxes"
#     })
#     description = "this is the rendered html"
# }

resource "local_file" "rendered_html" {
  content = templatefile("${path.module}/scripts/E12345678-council.html", {
    page_title = "Council Taxes"
  })
  filename = "${path.module}/scripts/E12345678-council-rendered.html"
}