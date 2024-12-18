locals {
  api_endpoint_triggers = [for _, endpoint in module.api_endpoints : endpoint.triggers]
  unique_endpoints      = distinct([for endpoint in var.api_endpoints : endpoint.path])

  endpoint_map = { for endpoint in local.unique_endpoints : endpoint => null }
}
