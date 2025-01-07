#!/bin/sh

cd terraform-ci-output

ls

checkov --framework terraform --directory .

checkov --framework terraform --directory . --skip-check CKV_TF_1
