#!/usr/bin/env python3
import os

def create_large_csv(filename, size_gb):
    """Create a large CSV file with realistic data structure"""
    size_bytes = size_gb * 1024 * 1024 * 1024
    
    # CSV header for council tax data
    header = "property_id,address,council_tax_band,annual_charge,payment_status\n"
    
    # Sample row (about 80 bytes)
    sample_row = "12345678,123 Main Street Anytown AB12 3CD,D,1500.00,PAID\n"
    
    with open(filename, 'w') as f:
        f.write(header)
        
        bytes_written = len(header)
        row_count = 0
        
        while bytes_written < size_bytes:
            # Vary the data slightly to make it more realistic
            row = f"{12345678 + row_count},123 Main Street Anytown AB12 3CD,D,{1500.00 + (row_count % 100):.2f},PAID\n"
            f.write(row)
            bytes_written += len(row)
            row_count += 1
            
            if row_count % 1000000 == 0:
                print(f"Written {bytes_written / (1024**3):.2f} GB ({row_count:,} rows)")

if __name__ == "__main__":
    create_large_csv("CTAX_EXTRACT_E12345678_20241201.csv", 80)
    print("80GB test file created successfully!")