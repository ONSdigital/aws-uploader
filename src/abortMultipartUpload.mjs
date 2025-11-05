import { S3Client, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({ region: 'eu-west-2' });

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { uploadId, key } = body;

    const command = new AbortMultipartUploadCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      UploadId: uploadId
    });

    await s3Client.send(command);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: "Upload aborted successfully"
      })
    };
  } catch (error) {
    console.error('Error aborting multipart upload:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: "Failed to abort upload",
        error: error.message
      })
    };
  }
};