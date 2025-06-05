SHELL := /bin/bash
mkfile_dir := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

.PHONY: behaviour-tests
## Run behaviour tests
behaviour-tests:
	@echo "Running behaviour tests"
	@yarn test
