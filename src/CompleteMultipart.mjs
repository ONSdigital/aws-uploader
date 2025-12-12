import { S3, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";

const s3 = new S3({ region: 'eu-west-2' });

export const handler = async (event, context) => {
  try {
    const { bucket, key, uploadId } = event.queryStringParameters;
    const { parts } = JSON.parse(event.body);

    const completeParams = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: decodeURIComponent(key),
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    });

    await s3.send(completeParams);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ message: 'Upload completed successfully' })
    };
  } catch (error) {
    console.error('Error completing multipart upload:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Failed to complete upload' })
    };
  }
};