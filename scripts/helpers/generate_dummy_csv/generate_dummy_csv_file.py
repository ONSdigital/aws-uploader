import os

# TODO: Change these values -->
unit_size = "KB"  # Options: "KB", "MB", "GB"
target_size = 1
output_file = "CTAX_MANI_E08000009_20260218.csv"
# TODO: <---

multipliers = {"KB": 1024, "MB": 1024 ** 2, "GB": 1024 ** 3}
target_bytes = target_size * multipliers[unit_size]

print(f"Generating ~{target_size}MB CSV file: {output_file}")

with open(output_file, "w") as csv_file:
    csv_file.write("col1,col2,col3,col4,col5\n")
    row = "aaa,bbb,ccc,ddd,eee\n"
    while csv_file.tell() < target_bytes:
        csv_file.write(row)

print(f"Done! {os.path.getsize(output_file) / (1024*1024):.2f}MB — {output_file}")
