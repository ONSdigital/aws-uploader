#!/bin/sh

cd terraform-ci-output

ls

checkov --framework terraform --directory .
