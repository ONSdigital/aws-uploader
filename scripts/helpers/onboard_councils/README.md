# Council Onboarding Helper

## Purpose
This helper tool bulk-onboards new councils from an Excel spreadsheet and updates the project-level `councils.csv` file automatically.

It replaces manual CSV editing with a safer, repeatable process.

## Prerequisites

You will need:

- Python installed
- Poetry installed: https://python-poetry.org/docs/#installation

To install dependencies for this helper:
```bash
poetry install
```

## Location
Run all commands from this directory
```text
scripts/helpers/onboard_councils/
```

## Input File Requirements
Provide an Excel file (.xlsx) containing the following two required headers:
- lad_code
- name

Notes:
* Source data can usually be copied directly from the Council Tax team spreadsheet
* No formatting changes are required other than ensuring the correct column headers are present

## Running the Tool
Execute the following where /path/to/input.xlsx is the above mentioned Excel file
```bash
poetry run python onboard_councils_from_xlsx.py /path/to/input.xlsx
```

Example (defaults to the Council Tax service)
```bash
poetry run python onboard_councils_from_xlsx.py ~/Downloads/new_councils.xlsx
```

## Choosing a Service
The tool onboards into a specific service's CSV. Pass `--service <id>` and it looks up that
service's `onboarding_csv` path in `services.tf` (the single source of truth) and writes there.
If omitted, it defaults to `council-tax`.

```bash
# Onboard into the Electoral Register service (data/electoral-register.csv)
poetry run python onboard_councils_from_xlsx.py ~/Downloads/new_er.xlsx --service electoral-register

# Default: Council Tax (data/councils.csv)
poetry run python onboard_councils_from_xlsx.py ~/Downloads/new_councils.xlsx
```

> The `<id>` must match a `service_id` defined in `services.tf`. The output filename comes from
> that service's `onboarding_csv` value — note it is not always `data/<id>.csv` (for example,
> `council-tax` writes to `data/councils.csv`).

## Optional Custom Output Path
To write to an explicit path (ignoring the service convention), pass `--councils-csv`. It overrides
`--service` when both are given.

```bash
poetry run python onboard_councils_from_xlsx.py ~/Downloads/input.xlsx --councils-csv /tmp/out.csv
```

## What the Tool Does
The helper will:
* Validate required column headers
* Clean council names
* Remove bracketed text and commas where applicable
* Apply standard title casing
* Preserve `UA` in uppercase
* Remove rows missing required values
* Detect duplicate councils
* Skip councils already onboarded
* Append new councils
* Sort output alphabetically
* Generate a timestamped log file

## Logs
Logs are written to:
```text
./logs
```

Review logs after each run for:
* Added councils
* Skipped rows
* Duplicate rows
* Missing values
* Validation warnings

## Notes
### Existing Councils
If a council name or LAD code already exists in `councils.csv`, it will be skipped.

### Naming Variations
Values such as:
* `and` vs `&`
* Official council wording
are preserved from the input spreadsheet

### Re-running Safely
The script can be re-run safely.  Existing councils are skipped automatically.

## Troubleshooting
### Poetry not found
Install Poetry first:
https://python-poetry.org/docs/#installation

### Missing dependencies
Run:
```bash
poetry install
```

## Input file not found
Check the file path passed into the command

## Missing columns
Ensure the input spreadsheet contains:
- `lad_code`
- `name`

## Recommended Workflow
1. Obtain latest council onboarding spreadsheet (create your own from information in the Jira ticket or liaise with Tim Powell)
2. Confirm headers are correct
3. Run the helper tool
4. Review the logs
5. Review updates `councils.csv`
6. Commit changes
