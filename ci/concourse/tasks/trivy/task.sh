#!/bin/sh

git config --global url.https://oauth2:${GIT_PAT}@github.com/.insteadOf https://github.com/

cd pull-request

trivy config .
