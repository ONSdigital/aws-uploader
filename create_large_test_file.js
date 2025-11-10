#!/usr/bin/env node
const fs = require('fs');

function createLargeCSV(filename, sizeGB) {
    const sizeBytes = sizeGB * 1024 * 1024 * 1024;
    const stream = fs.createWriteStream(filename);
    
    const header = "property_id,address,council_tax_band,annual_charge,payment_status\n";
    stream.write(header);
    
    let bytesWritten = header.length;
    let rowCount = 0;
    
    // Create a buffer of 1000 rows to write at once (more efficient)
    const createRowBatch = (startRow, batchSize) => {
        let batch = '';
        for (let i = 0; i < batchSize; i++) {
            const rowNum = startRow + i;
            batch += `${12345678 + rowNum},123 Main Street Anytown AB12 3CD,D,${(1500.00 + (rowNum % 100)).toFixed(2)},PAID\n`;
        }
        return batch;
    };
    
    const writeBatch = () => {
        if (bytesWritten >= sizeBytes) {
            stream.end();
            console.log(`80GB test file created successfully! (${rowCount:,} rows)`);
            return;
        }
        
        const batch = createRowBatch(rowCount, 1000);
        stream.write(batch);
        bytesWritten += batch.length;
        rowCount += 1000;
        
        if (rowCount % 1000000 === 0) {
            console.log(`Written ${(bytesWritten / (1024**3)).toFixed(2)} GB (${rowCount:,} rows)`);
        }
        
        setImmediate(writeBatch); // Non-blocking
    };
    
    writeBatch();
}

createLargeCSV("CTAX_EXTRACT_E12345678_20241201.csv", 80);