# Dummy CSV File Generator

A simple helper script for generating dummy CSV files of a specified size.  Useful for testing file uploads for the CT Uploader.

## Usage

1. Open `generate_dummy_csv_file.py` and update the configuration variables at the top of the file:
```python
unit_size = "KB"   # Options: "KB", "MB", "GB"
target_size = 1
output_file = "CTAX_MANI_E08000009_20260218.csv"
```

| Variable | Description |
|---|---|
| `unit_size` | The unit for the target file size. One of `"KB"`, `"MB"`, or `"GB"`. |
| `target_size` | The desired file size as a number (e.g. `10` for 10 MB). |
| `output_file` | The name of the output CSV file to generate. |

2. Run the script:
```bash
python generate_dummy_csv_file.py
```
The output file will be created in the current working directory

## Output

The generated CSV contains 5 columns with placeholder values:
```csv
col1,col2,col3,col4,col5
aaa,bbb,ccc,ddd,eee
aaa,bbb,ccc,ddd,eee
```

This script will print progress and a confirmation when complete:
```bash
Generating ~1MB CSV file: output.csv
Done! 1.00MB - output.csv
```

## Notes
* The final size may be very slightly over the target size, as the script checks size after each row write.
* The script overwrites any existing file with the same name as `output_file` without warning.

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
Place the input file into the same directory as onboard_councils_from_csv.py, then run:
`python onboard_councils_from_csv.py`

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