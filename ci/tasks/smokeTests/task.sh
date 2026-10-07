#!/bin/sh
set -e

cd repo-git

: "${TF_VARS:?TF_VARS must be set to the env tfvars path, e.g. env/dev.tfvars}"

DOMAIN_NAME=$(sed -n 's/^[[:space:]]*domain_name[[:space:]]*=[[:space:]]*"\(.*\)"[[:space:]]*$/\1/p' "${TF_VARS}")

if [ -z "${DOMAIN_NAME}" ]; then
  echo "Could not read domain_name from ${TF_VARS}" >&2
  exit 1
fi

BASE_DOMAIN="uploader.${DOMAIN_NAME}"
echo "Resolved uploader base domain from ${TF_VARS}: ${BASE_DOMAIN}"

node test/smoke/check_council_urls.js --base "${BASE_DOMAIN}"
