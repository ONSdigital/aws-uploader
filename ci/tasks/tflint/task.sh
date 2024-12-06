#!/bin/sh

set -eux pipefail
pwd

cd terraform-output

tflint --init

tflint --config .tflint.hcl -f junit
