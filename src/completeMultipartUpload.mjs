import { S3Client, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({ region: 'eu-west-2' });

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { uploadId, key, parts } = body;

    const command = new CompleteMultipartUploadCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
      }
    });

    const result = await s3Client.send(command);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: "Upload completed successfully",
        location: result.Location,
        etag: result.ETag
      })
    };
  } catch (error) {
    console.error('Error completing multipart upload:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: "Failed to complete upload",
        error: error.message
      })
    };
  }
};