# Multipart Upload Implementation

## Overview
This implementation completes the multipart file upload functionality for large files in the AWS Uploader system. The solution handles files larger than the standard upload limits by breaking them into smaller chunks.

## Components Added

### 1. Lambda Functions

#### `multiparturl.mjs`
- **Purpose**: Initiates multipart uploads and generates presigned URLs for each part
- **Endpoint**: `GET /multipart-url`
- **Features**:
  - Validates file types and names (same validation as regular uploads)
  - Calculates optimal number of parts (40MB chunks, max 10,000 parts)
  - Returns upload IDs and presigned URLs for all parts

#### `completeMultipartUpload.mjs`
- **Purpose**: Completes multipart uploads after all parts are uploaded
- **Endpoint**: `POST /complete-multipart`
- **Input**: `{ uploadId, key, parts: [{ PartNumber, ETag }] }`

#### `abortMultipartUpload.mjs`
- **Purpose**: Aborts incomplete multipart uploads for cleanup
- **Endpoint**: `POST /abort-multipart`
- **Input**: `{ uploadId, key }`

### 2. Frontend JavaScript (`multi_file_submission.js`)

#### Key Features:
- **Chunk Upload**: Splits files into 40MB chunks
- **Progress Tracking**: Logs upload progress for each part
- **Error Handling**: Automatically aborts incomplete uploads on failure
- **Completion**: Calls completion endpoint after all parts are uploaded

#### Upload Flow:
1. File validation (same as regular uploads)
2. Request multipart upload URLs
3. Upload each part sequentially
4. Collect ETags from successful uploads
5. Complete multipart upload
6. Redirect to success page

### 3. Infrastructure Updates

#### Terraform Changes:
- Added Lambda functions for multipart operations
- Updated IAM permissions to include multipart S3 actions
- Added API Gateway routes and integrations
- Updated CORS to allow POST methods

#### S3 Permissions Added:
- `s3:CreateMultipartUpload`
- `s3:CompleteMultipartUpload`
- `s3:AbortMultipartUpload`
- `s3:ListMultipartUploadParts`

## File Size Handling

### Chunk Size: 40MB
- Balances upload speed with memory usage
- Allows files up to 400GB (10,000 parts × 40MB)
- Suitable for typical council tax data files

### Part Calculation:
```javascript
const calculatePartCount = (totalSizeInBytes, maxPartSize = 40 * 1024 * 1024) => {
    const partCount = Math.ceil(totalSizeInBytes / maxPartSize);
    return Math.min(partCount, 10000); // S3 limit
};
```

## Error Handling

### Validation:
- Same file validation as regular uploads
- File type must be CSV
- File names must match LAD code pattern
- Files cannot be empty

### Upload Failures:
- Automatic abort of incomplete uploads
- User-friendly error messages
- Cleanup of partial uploads to prevent storage costs

### Network Issues:
- Individual part retry capability (can be enhanced)
- Graceful degradation to error state

## Usage

### For Regular Files (< 40MB):
- System automatically uses regular presigned URL upload
- No changes to existing functionality

### For Large Files (> 40MB):
- System automatically uses multipart upload
- Transparent to the user
- Same validation and success flow

## Deployment

### Prerequisites:
1. Deploy updated Terraform configuration
2. Ensure Lambda functions have correct permissions
3. Update S3 bucket policies

### Steps:
```bash
terraform plan -var-file=env/env.tfvars
terraform apply -var-file=env/env.tfvars
```

## Monitoring

### CloudWatch Logs:
- Lambda execution logs for each function
- API Gateway access logs
- Detailed error logging with LAD codes and file names

### Metrics to Monitor:
- Multipart upload success/failure rates
- Upload duration for large files
- Part upload retry rates
- Incomplete upload cleanup frequency

## Future Enhancements

### Potential Improvements:
1. **Parallel Part Uploads**: Upload multiple parts simultaneously
2. **Progress Bar**: Real-time upload progress indicator
3. **Resume Capability**: Resume interrupted uploads
4. **Automatic Retry**: Retry failed parts automatically
5. **File Size Optimization**: Dynamic chunk size based on file size

### Performance Optimizations:
1. **Connection Pooling**: Reuse HTTP connections
2. **Compression**: Compress parts before upload (if beneficial)
3. **CDN Integration**: Use CloudFront for upload acceleration

## Security Considerations

### Current Implementation:
- Presigned URLs expire in 1 hour
- Same CORS and security headers as regular uploads
- IAM permissions follow least privilege principle

### Additional Security:
- Consider shorter expiration times for parts
- Implement upload rate limiting
- Add file content validation beyond file type

## Testing

### Test Scenarios:
1. **Small Files**: Ensure regular upload still works
2. **Large Files**: Test multipart upload flow
3. **Network Interruption**: Test error handling and cleanup
4. **Invalid Files**: Ensure validation still works
5. **Concurrent Uploads**: Test multiple users uploading simultaneously

### Test Files:
- Create test CSV files of various sizes (1MB, 50MB, 100MB, 500MB)
- Test with valid and invalid file names
- Test with corrupted files