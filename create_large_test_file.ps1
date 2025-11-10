# PowerShell script to create 80GB CSV file
param(
    [string]$filename = "CTAX_EXTRACT_E12345678_20241201.csv",
    [int]$sizeGB = 80
)

$sizeBytes = $sizeGB * 1GB
$header = "property_id,address,council_tax_band,annual_charge,payment_status`n"

Write-Host "Creating $sizeGB GB test file: $filename"

$stream = [System.IO.StreamWriter]::new($filename)
$stream.Write($header)

$bytesWritten = $header.Length
$rowCount = 0

while ($bytesWritten -lt $sizeBytes) {
    $row = "$($12345678 + $rowCount),123 Main Street Anytown AB12 3CD,D,$([math]::Round(1500.00 + ($rowCount % 100), 2)),PAID`n"
    $stream.Write($row)
    $bytesWritten += $row.Length
    $rowCount++
    
    if ($rowCount % 1000000 -eq 0) {
        $gbWritten = [math]::Round($bytesWritten / 1GB, 2)
        Write-Host "Written $gbWritten GB ($rowCount rows)"
    }
}

$stream.Close()
Write-Host "80GB test file created successfully! ($rowCount rows)"