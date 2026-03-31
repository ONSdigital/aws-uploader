# Onboard Councils from CSV

A helper class for onboarding new councils by reading a formatted input file (CSV or XLSX) and merging the entries into the main councils.csv in alphabetical order.

## What it does

* Reads council name and LAD code from an input file
* Applies the following formatting to each entry:
  * Council names are converted to Proper Case, with 'UA' always fully capitalised, e.g., 'Portsmouth UA'
  * Anything inside brackets '()' is removed, including the delimiters themselves
  * Leading and trailing whitespace is stripped
* Rows with an empty name or LAD code after cleaning are skipped
* Merges the new rows into councils.csv, removes exact duplicates, and sorts the result A-Z by council name

## Usage

Open `onboard_councils_from_csv.py` and update the variables in the `__main__` block at the bottom of the file:

```python
# Required: path to the input XLSX file
input_file_path = "tests/test_data/input (1).xlsx"

# Optional: defaults to "../../councils.csv" if not set
councils_csv = "test_data/councils (1).csv"

# Optional: defaults to "../../councils.csv" if not set
output_path = "tests/test_data/councils (1).csv"
```

| Variable | Required | Description |
|---|---|---|
| `input_file_path` | Yes | Path to the input XLSX file containing new councils to onboard. |
| `councils_csv` | No | Path to the existing councils CSV to merge into. |
| `output_path` | No | Path to write the merged output CSV. |

> ⚠️ **Warning:** If `councils_csv` and `output_path` are left as their defaults, the production councils list at `../../councils.csv` will be overwritten. It is strongly recommended to test against local copies first before removing the custom path overrides.

Then run:
```bash
python onboard_councils_from_csv.py
```

### Notes
Rows where the LAD code is wrapped in brackets will be dropped after cleaning.

## Setup
Dependencies are managed with Poetry, scoped to this directory only.

### Prerequisites
* Python 3.x
* Poetry installed - see the official installation guide

### Install dependencies
```
cd scripts/     # or whichever directory contains pyproject.toml
poetry install
```

This will create a `.venv` virtual environment inside the directory (as configured in `poetry.toml` and install all required packages).

### Adding new dependencies
```
poetry run pytest
```

To run a specific test file:
```
poetry run pytest/test_onboard_councils.py
```

To run with verbose output:
```
poetry run pytest -v
```