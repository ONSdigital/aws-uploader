SHELL := /bin/bash
mkfile_dir := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

.PHONY: behaviour-tests
## Run behaviour tests
behaviour-tests:
	@echo "Running behaviour tests"
	@yarn test

.PHONY: check-formatting
## Check code formatting
check-formatting:
	@echo "Checking formatting"
	@npx prettier --check "**/*.js"

.PHONY: format
## Format code
format:
	@echo "Formatting"
	@npx prettier --write "**/*.js"
