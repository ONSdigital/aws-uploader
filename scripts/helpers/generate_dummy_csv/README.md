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
