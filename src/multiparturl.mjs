import querystring from 'querystring';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { 
  S3,
  PutObjectCommand,
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand
} from "@aws-sdk/client-s3";

class uploaderLogger {
  logError(LADCode, fileName, fileSize, statusCode, errorMessage) {
    console.error(`Status: ${statusCode}, LADCode: ${LADCode}, File: ${fileName}, File size: ${fileSize} MB, Message: ${errorMessage}`);
  }

  logInternalError(LADCode, fileName, statusCode, errorMessage) {
    console.error(`Status: ${statusCode}, LADCode: ${LADCode}, File: ${fileName}, Message: ${errorMessage}`);
  }

  logInfo(infoMessage) {
    console.log(`Info: ${infoMessage}`);
  }

  logSuccess(LADCode, fileName, URL, statusCode) {
    console.log(`Success: Status: ${statusCode}, LADCode: ${LADCode}, fileName: ${fileName}, URL: ${URL}`);
  }
}

const s3 = new S3({region: 'eu-west-2'});
const logger = new uploaderLogger();

export const handler = async (event, context, callback) => {
  let LADCode;
  try {
    logger.logInfo("Starting verification checks");
  
    //-- Starting verification checks --
    let trimmedFileOneNameToCheckIfFilesMatch = event.queryStringParameters.fileOneName.slice(0, 5) + event.queryStringParameters.fileOneName.slice(12, 31);
    let trimmedFileTwoNameToCheckIfFilesMatch = event.queryStringParameters.fileTwoName.slice(0, 5) + event.queryStringParameters.fileTwoName.slice(9, 28);
    LADCode = event.queryStringParameters.fileOneName.slice(13, 22);
    const currentDate = new Date();
    const formatedDate = currentDate.toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    
    if(event.queryStringParameters.fileOneSize === "0") {
      const result = await isFileEmpty(event.queryStringParameters.fileOneName);
      const resultBody = JSON.parse(result.body);
      logger.logError(LADCode, event.queryStringParameters.fileOneName, event.queryStringParameters.fileOneSize, result.statusCode, resultBody.message);
      return result;
    } else if (event.queryStringParameters.fileTwoSize === "0") {
      const result = await isFileEmpty(event.queryStringParameters.fileTwoName);
      const resultBody = JSON.parse(result.body);
      logger.logError(LADCode, event.queryStringParameters.fileTwoName, event.queryStringParameters.fileTwoSize, result.statusCode, resultBody.message);
      return result;
    } else if(event.queryStringParameters.fileOneType !== "text/csv") {
      const result = await fileNotCSV(event.queryStringParameters.fileOneName);
      const resultBody = JSON.parse(result.body);
      logger.logError(LADCode, event.queryStringParameters.fileOneName, event.queryStringParameters.fileOneSize, result.statusCode, resultBody.message);
      return result;
    } else if(event.queryStringParameters.fileTwoType !== "text/csv") {
      const result = await maniFileNotCSV(event.queryStringParameters.fileTwoName);
      const resultBody = JSON.parse(result.body);
      logger.logError(LADCode, event.queryStringParameters.fileTwoName, event.queryStringParameters.fileTwoSize, result.statusCode, resultBody.message);
      return result;
    } else if (trimmedFileOneNameToCheckIfFilesMatch != trimmedFileTwoNameToCheckIfFilesMatch) {
      const result = await fileNamesDontMatch(event);
      const resultBody = JSON.parse(result.body);
      logger.logError(LADCode, event.queryStringParameters.fileOneName, event.queryStringParameters.fileOneSize, result.statusCode, resultBody.message);
      return result;
    } else {
      const result = await getUploadURL(event, LADCode, formatedDate);
      const resultBody = JSON.parse(result.body);
      logger.logSuccess(LADCode, event.queryStringParameters.fileOneName, JSON.stringify(resultBody.fileOne), result.statusCode);
      logger.logSuccess(LADCode, event.queryStringParameters.fileTwoName, JSON.stringify(resultBody.fileTwo), result.statusCode);
      return result;
    }
  } catch (error) {
    logger.logInternalError(LADCode, event.queryStringParameters.fileOneName, "500", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        error: error.message
      })
    };
  }
}

const fileNotCSV = async (filename) => {
  return {
    "statusCode": 403,
    "isBase64Encoded": false,
    "headers": { 'Access-Control-Allow-Origin': '*' },
    "body": JSON.stringify({
      "message": "File is not .csv",
      "filename": filename
    })
  };
}

const maniFileNotCSV = async (filename) => {
  return {
    "statusCode": 403,
    "isBase64Encoded": false,
    "headers": { 'Access-Control-Allow-Origin': '*' },
    "body": JSON.stringify({
      "message": "maniFile is not .csv",
      "filename": filename
    })
  };
}

const isFileEmpty = async (filename) => {
  return {
    "statusCode": 204,
    "isBase64Encoded": false,
    "headers": { 'Access-Control-Allow-Origin': '*' },
    "body": JSON.stringify({
      "message": `File is empty`,
      "filename": filename
    })
  };
}

const fileNamesDontMatch = async (event) => {
  return {
    "statusCode": 300,
    "isBase64Encoded": false,
    "headers": { 'Access-Control-Allow-Origin': '*' },
    "body": JSON.stringify({
      "message": "File names do not match"
    })
  };
}

const getUploadURL = async (event, LADCode, formatedDate) => {
  const client = new S3Client({ region: 'eu-west-2' });
  
  // Function to calculate number of parts needed
  const calculatePartCount = (totalSizeInBytes, maxPartSize = 40 * 1024 * 1024) => {
    const partCount = Math.ceil(totalSizeInBytes / maxPartSize);
    // Ensure we don't exceed S3's 10,000 parts limit
    return Math.min(partCount, 10000);
  };

  // Function to create multipart upload URLs
  const createMultipartUpload = async (fileName, fileSize) => {
    const createCommand = {
      Bucket: process.env.BUCKET_NAME,
      Key: `council-tax/${LADCode}/${formatedDate}/${fileName}`,
    };

    try {
      // Create the multipart upload
      const multipartUpload = await client.send(new CreateMultipartUploadCommand(createCommand));
      const uploadId = multipartUpload.UploadId;

      // Calculate number of parts needed based on file size
      const partCount = calculatePartCount(parseInt(fileSize));
      
      // Generate presigned URLs for parts
      const partUrls = await Promise.all(
        Array.from({ length: partCount }, async (_, index) => {
          const command = new UploadPartCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: `council-tax/${LADCode}/${formatedDate}/${fileName}`,
            UploadId: uploadId,
            PartNumber: index + 1,
          });

          const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
          return {
            partNumber: index + 1,
            url: signedUrl
          };
        })
      );

      return {
        uploadId,
        partUrls,
        key: createCommand.Key,
        totalParts: partCount
      };
    } catch (error) {
      console.error('Error creating multipart upload:', error);
      throw error;
    }
  };

  // Create multipart upload URLs for both files
  const [fileOneUpload, fileTwoUpload] = await Promise.all([
    createMultipartUpload(
      event.queryStringParameters.fileOneName, 
      event.queryStringParameters.fileOneSize
    ),
    createMultipartUpload(
      event.queryStringParameters.fileTwoName, 
      event.queryStringParameters.fileTwoSize
    )
  ]);

  return {
    statusCode: 200,
    isBase64Encoded: false,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      fileOne: {
        uploadId: fileOneUpload.uploadId,
        partUrls: fileOneUpload.partUrls,
        key: fileOneUpload.key,
        totalParts: fileOneUpload.totalParts
      },
      fileTwo: {
        uploadId: fileTwoUpload.uploadId,
        partUrls: fileTwoUpload.partUrls,
        key: fileTwoUpload.key,
        totalParts: fileTwoUpload.totalParts
      },
      message: "Success"
    })
  };
};
