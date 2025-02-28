data "template_file" "templating_html" {
    template = file ("${path.module}/scripts/E12345678-council.html")
    vars = {
        page_title = "Council Taxes"
    }
}
output "rendered_html" {
    value = data.template_file.templating.html.rendered
    description = "this is the rendered html"
}