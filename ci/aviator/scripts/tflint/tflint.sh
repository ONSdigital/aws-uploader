#!/bin/sh

set -eux pipefail

tflint --init

tflint --config .tflint.hcl -f junit
