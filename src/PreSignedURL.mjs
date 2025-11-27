import querystring from 'querystring';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

  logSuccess(LADCode, fileName, URL, statusCode, CouncilName) {
    console.log(`Success: CouncilName: ${CouncilName}, Status: ${statusCode}, LADCode: ${LADCode}, fileName: ${fileName}, URL: ${URL}`);
  }
}

function cleanCouncilName(councilName) {
  return councilName.replace(/[!_\-.*'()&$@=;/+:,?\\{}^}%`[\]"<>#|~]/g, "").replace(/ /g, "");
}

// New way of using AWS SDk v3
import { S3, PutObjectCommand, S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3"
const s3 = new S3({ region: 'eu-west-2' });
const logger = new uploaderLogger()

const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10MB threshold for multipart

function convertExtensionToLowerCase(filename) {
  const fileParts = filename.split('.');
  const fileExtension = fileParts.pop();
  const fileNameWithoutExtension = fileParts.join('.');
  return fileNameWithoutExtension + '.' + fileExtension.toLowerCase();
}

export const handler = async (event, context, callback) => {
  try {
    logger.logInfo("Starting verification checks")

    //-- Starting verification checks --

    //create variables to complete file verificatin checks
    let trimmedFileOneNameToCheckIfFilesMatch = event.queryStringParameters.fileOneName.slice(0, 5) + event.queryStringParameters.fileOneName.slice(12, 31); //trim file one name to just the parts which should exactly match file two
    let trimmedFileTwoNameToCheckIfFilesMatch = event.queryStringParameters.fileTwoName.slice(0, 5) + event.queryStringParameters.fileTwoName.slice(9, 28); //trim file two name to just the parts which should match file one name
    logger.logInfo("Getting ladcode")
    let LADCode = event.queryStringParameters.fileOneName.slice(13, 22);
    logger.logInfo(LADCode)
    // let CouncilName = document.getElementById('council-name').innerHTML;
    let CouncilName = decodeURIComponent(event.queryStringParameters.councilName); //here
    logger.logInfo(CouncilName)

    const currentDate = new Date();
    const formatedDate = currentDate.toISOString().replace(/[^0-9]/g, '').slice(0, -3)
    //Series of checks on file data before pre-signed URLs are created. Checks size of each file isnt 0, checks file type of each file is csv, check if file names match.
    //Need to add file name format verification.

    if (event.queryStringParameters.fileOneSize === "0") {
      const result = await isFileEmpty(event.queryStringParameters.fileOneName);
      const resultBody = JSON.parse(result.body);
      logger.logError(event.queryStringParameters.fileOneName.slice(13, 22), event.queryStringParameters.fileOneName, event.queryStringParameters.fileOneSize, result.statusCode, resultBody.message);
      return result;
    } else if (event.queryStringParameters.fileTwoSize === "0") {
      const result = await isFileEmpty(event.queryStringParameters.fileTwoName);
      const resultBody = JSON.parse(result.body);
      logger.logError(event.queryStringParameters.fileOneName.slice(13, 22), event.queryStringParameters.fileTwoName, event.queryStringParameters.fileTwoSize, result.statusCode, resultBody.message);
      return result;
    } else if (event.queryStringParameters.fileOneType !== "text/csv") {
      const result = await fileNotCSV(event.queryStringParameters.fileOneName);
      const resultBody = JSON.parse(result.body);
      logger.logError(event.queryStringParameters.fileOneName.slice(13, 22), event.queryStringParameters.fileOneName, event.queryStringParameters.fileOneSize, result.statusCode, resultBody.message);
      return result;
    } else if (event.queryStringParameters.fileTwoType !== "text/csv") {
      const result = await maniFileNotCSV(event.queryStringParameters.fileTwoName);
      const resultBody = JSON.parse(result.body);
      logger.logError(event.queryStringParameters.fileTwoName.slice(13, 22), event.queryStringParameters.fileTwoName, event.queryStringParameters.fileTwoSize, result.statusCode, resultBody.message);
      return result;
    } else if (trimmedFileOneNameToCheckIfFilesMatch != trimmedFileTwoNameToCheckIfFilesMatch) {
      const result = await fileNamesDontMatch(event);
      const resultBody = JSON.parse(result.body);
      logger.logError(event.queryStringParameters.fileOneName.slice(13, 22), event.queryStringParameters.fileOneName, event.queryStringParameters.fileOneSize, result.statusCode, resultBody.message);
      return result;
    } else {
      const result = await getUploadURL(event, formatedDate, CouncilName);
      const resultBody = JSON.parse(result.body);
      logger.logSuccess(LADCode, event.queryStringParameters.fileOneName, 'multipart/single', result.statusCode, CouncilName);
      logger.logSuccess(LADCode, event.queryStringParameters.fileTwoName, 'multipart/single', result.statusCode, CouncilName);
      return result;
    }
  } catch (error) {
    let LADCode = event.queryStringParameters.fileOneName.slice(13, 22);
    let CouncilName = event.queryStringParameters.councilName;
    logger.logInternalError(LADCode, "foo", "500", error.message, CouncilName);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        error: error.message
      })
    };
  }
}

//sends reponse if a file is not csv which alerts user
const fileNotCSV = async (filename) => {
  return new Promise((resolve, reject) => {
    resolve({
      "statusCode": 403,
      "isBase64Encoded": false,
      "headers": {
        'Access-Control-Allow-Origin': '*'
      },
      "body": JSON.stringify({
        "message": "File is not .csv",
        "filename": filename
      })
    })
  })
}

const maniFileNotCSV = async (filename) => {
  return new Promise((resolve, reject) => {
    resolve({
      "statusCode": 403,
      "isBase64Encoded": false,
      "headers": {
        'Access-Control-Allow-Origin': '*'
      },
      "body": JSON.stringify({
        "message": "maniFile is not .csv",
        "filename": filename
      })
    })
  })
}


//sends response if file is empty and alerts user
const isFileEmpty = async (filename) => {
  return new Promise((resolve, reject) => {
    resolve({
      "statusCode": 204,
      "isBase64Encoded": false,
      "headers": {
        'Access-Control-Allow-Origin': '*'
      },
      "body": JSON.stringify({
        "message": `File is empty`,
        "filename": filename
      })
    })
  })
}

//sends response if a file names dont match
const fileNamesDontMatch = async (event) => {

  return new Promise((resolve, reject) => {

    resolve({
      "statusCode": 300,
      "isBase64Encoded": false,
      "headers": {
        'Access-Control-Allow-Origin': '*'
      },
      "body": JSON.stringify({
        "message": "File names do not match"
      })
    })
  })
}

//if all checks pass, then the pre-signed url for each file is created and returned to user which triggers automatic upload of each file to s3 bucket
const getUploadURL = async (event, formatedDate, councilName) => {

  councilName = cleanCouncilName(councilName)
  let fileOneNameLowerCase = convertExtensionToLowerCase(event.queryStringParameters.fileOneName)
  let fileTwoNameLowerCase = convertExtensionToLowerCase(event.queryStringParameters.fileTwoName)

  const fileOneSize = parseInt(event.queryStringParameters.fileOneSize);
  const fileTwoSize = parseInt(event.queryStringParameters.fileTwoSize);

  const fileOneUpload = await createUploadData(fileOneNameLowerCase, fileOneSize, formatedDate, councilName);
  const fileTwoUpload = await createUploadData(fileTwoNameLowerCase, fileTwoSize, formatedDate, councilName);

  return new Promise((resolve, reject) => {
    resolve({
      "statusCode": 200,
      "isBase64Encoded": false,
      "headers": {
        'Access-Control-Allow-Origin': '*',
      },
      "body": JSON.stringify({
        "fileOneUpload": fileOneUpload,
        "fileTwoUpload": fileTwoUpload,
        "message": "Success",
      })
    })
  })
}

const createUploadData = async (fileName, fileSize, formatedDate, councilName) => {
  const key = `council-tax/${councilName}/${formatedDate}/${fileName}`;
  
  if (fileSize > MULTIPART_THRESHOLD) {
    return await createMultipartUpload(key, fileSize);
  } else {
    const s3Params = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key
    });
    const uploadURL = await getSignedUrl(s3, s3Params, { expiresIn: 1800 });
    return { uploadURL, multipart: false };
  }
}

const createMultipartUpload = async (key, fileSize) => {
  const createParams = new CreateMultipartUploadCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key
  });
  
  const createResult = await s3.send(createParams);
  const uploadId = createResult.UploadId;
  
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  const numParts = Math.ceil(fileSize / CHUNK_SIZE);
  const parts = [];
  
  for (let i = 1; i <= numParts; i++) {
    const uploadPartParams = new UploadPartCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      PartNumber: i,
      UploadId: uploadId
    });
    
    const uploadURL = await getSignedUrl(s3, uploadPartParams, { expiresIn: 1800 });
    parts.push({ PartNumber: i, uploadURL });
  }
  
  return {
    multipart: true,
    uploadId,
    parts,
    completeURL: `${process.env.API_GATEWAY_URL}complete-multipart?bucket=${process.env.BUCKET_NAME}&key=${encodeURIComponent(key)}&uploadId=${uploadId}`
  };
}
