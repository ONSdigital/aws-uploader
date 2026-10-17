#!/bin/sh
set -e

cd repo-git

# ---------------------------------------------------------------------------
# Setup (quietened): the selenium/node-chrome image ships Chrome but not npm,
# so we install it here. apt/npm progress output is suppressed to -qq / --silent
# so it doesn't bury the test result; real errors are still surfaced because
# `set -e` aborts on a non-zero exit.
# ---------------------------------------------------------------------------
echo "=== Installing test dependencies (output suppressed) ==="
# Redirect both stdout and stderr: apt emits routine "Target Packages ...
# configured multiple times" warnings on stderr. `set -e` still aborts the task
# on a real non-zero exit, so genuine failures are not hidden.
sudo apt-get update -qq >/dev/null 2>&1
sudo apt-get install -y -qq npm >/dev/null 2>&1
npm install --silent >/dev/null 2>&1

# ---------------------------------------------------------------------------
# Run the behaviour tests. The banner makes the result easy to locate in the
# task log, and cucumber's summary/progress-bar formatters (configured in
# cucumber.js) print a readable pass/fail breakdown.
# ---------------------------------------------------------------------------
echo ""
echo "=================================================="
echo "=== RUNNING BEHAVIOUR TESTS                    ==="
echo "=================================================="
npm test
