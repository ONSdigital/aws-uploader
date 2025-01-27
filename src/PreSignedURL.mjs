import querystring from 'querystring';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

class uploaderLogger {
  logError(LADCode, fileName, statusCode, errorMessage) {
    console.error(`Status: ${statusCode}, LADCode: ${LADCode}, File: ${fileName}, Message: ${errorMessage}`);
  }

  logInternalError(LADCode, fileName, statusCode, errorMessage) {
    console.error(`Status: ${statusCode}, LADCode: ${LADCode}, File: ${fileName}, Message: ${errorMessage}`);
  }

  logInfo(infoMessage) {
      console.log(`Info: ${infoMessage}`);
  }

  logSuccess(LADCode, fileName, URL, statusCode) {
    console.log(`Success: Status: ${statusCode}, LADCode: ${LADCode}, fileName: ${fileName}, URL: ${URL}`);}
}



// New way of using AWS SDk v3
import { S3, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
const s3 = new S3({region: 'eu-west-2'});
const logger = new uploaderLogger()


export const handler = async (event, context, callback) => {
  try{
    logger.logInfo("Starting verification checks")
  
    //-- Starting verification checks --
    
    //create variables to complete file verificatin checks
    let trimmedFileOneNameToCheckIfFilesMatch = event.queryStringParameters.fileOneName.slice(0, 5) + event.queryStringParameters.fileOneName.slice(12, 31); //trim file one name to just the parts which should exactly match file two
    let trimmedFileTwoNameToCheckIfFilesMatch = event.queryStringParameters.fileTwoName.slice(0, 5) + event.queryStringParameters.fileTwoName.slice(9, 28); //trim file two name to just the parts which should match file one name
    let LADCode = event.queryStringParameters.fileOneName.slice(13, 22);
    const currentDate = new Date();
    const formatedDate = currentDate.toISOString()
    //Series of checks on file data before pre-signed URLs are created. Checks size of each file isnt 0, checks file type of each file is csv, check if file names match.
    //Need to add file name format verification.
    
    if(event.queryStringParameters.fileOneSize==="0") {
      const result = await isFileEmpty(event.queryStringParameters.fileOneName);
      const resultBody = JSON.parse(result.body);
      logger.logError(event.queryStringParameters.fileOneName.slice(13, 22), event.queryStringParameters.fileOneName, result.statusCode, resultBody.message);
      return result;
    } else  if (event.queryStringParameters.fileTwoSize==="0") {
      const result = await isFileEmpty(event.queryStringParameters.fileTwoName);
      const resultBody = JSON.parse(result.body);
      logger.logError(event.queryStringParameters.fileOneName.slice(13, 22), event.queryStringParameters.fileOneName, result.statusCode, resultBody.message);
      return result;
    } else if(event.queryStringParameters.fileOneType !== "text/csv"){
      const result = await fileNotCSV(event.queryStringParameters.fileOneName);
      const resultBody = JSON.parse(result.body);
      logger.logError(event.queryStringParameters.fileOneName.slice(13, 22), event.queryStringParameters.fileOneName, result.statusCode, resultBody.message);
      return result;
    } else if(event.queryStringParameters.fileTwoType !== "text/csv"){
      const result = await fileNotCSV(event.queryStringParameters.fileTwoName);
      const resultBody = JSON.parse(result.body);
      logger.logError(event.queryStringParameters.fileOneName.slice(13, 22), event.queryStringParameters.fileOneName, result.statusCode, resultBody.message);
      return result;
    } else if (trimmedFileOneNameToCheckIfFilesMatch != trimmedFileTwoNameToCheckIfFilesMatch){
      const result = await fileNamesDontMatch(event);
      const resultBody = JSON.parse(result.body);
      logger.logError(event.queryStringParameters.fileOneName.slice(13, 22), event.queryStringParameters.fileOneName, result.statusCode, resultBody.message);
      return result;
    } else {
      const result = await getUploadURL(event, LADCode, formatedDate);
      const resultBody = JSON.parse(result.body);
      logger.logSuccess(LADCode, event.queryStringParameters.fileOneName, resultBody.uploadURLFileOne, result.statusCode);
      return result;
    }
  } catch (error){
    logger.logInternalError(LADCode, eventNames.queryStringParameters.fileOneName, "500", error.message);
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
      "headers": { 'Access-Control-Allow-Origin': '*'
         },
      "body": JSON.stringify({
        "message": "File is not .csv",
        "filename" : filename
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
      "headers": { 'Access-Control-Allow-Origin': '*'
         },
      "body": JSON.stringify({
        "message": `File is empty`,
        "filename" : filename
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
      "headers": { 'Access-Control-Allow-Origin': '*'
         },
      "body": JSON.stringify({
        "message": "File names do not match"
      })
    })
  })
}

//if all checks pass, then the pre-signed url for each file is created and returned to user which triggers automatic upload of each file to s3 bucket
const getUploadURL = async (event,LADCode,formatedDate) => {
  
  
  const  s3ParamsFileOne = new PutObjectCommand({
     Bucket: process.env.BUCKET_NAME, //bucket used for ingested files
    Key: `council-tax/${LADCode}/${formatedDate}/${event.queryStringParameters.fileOneName}`
    
  })
  
  const  s3ParamsFileTwo = new PutObjectCommand({
     Bucket: process.env.BUCKET_NAME,
    Key: `council-tax/${LADCode}/${formatedDate}/${event.queryStringParameters.fileTwoName}`
    
  })
  const client = new S3Client({
    
    
  }) 
   let uploadURLFileOne = await getSignedUrl(s3, s3ParamsFileOne, { expiresIn: 90 })
    let uploadURLFileTwo = await getSignedUrl(s3, s3ParamsFileTwo, { expiresIn: 90 })
return new Promise((resolve, reject) => {
   
      resolve({
      "statusCode": 200,
      "isBase64Encoded": false,
      "headers": { 'Access-Control-Allow-Origin': '*',
         },
      "body": JSON.stringify({
        "uploadURLFileOne": uploadURLFileOne,
        "uploadURLFileTwo" : uploadURLFileTwo,
        "message" : "Success",
      })
    })
  })
  
}
