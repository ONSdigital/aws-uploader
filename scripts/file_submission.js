class uploaderLogger {
    logError(errorMessage) {
        console.error(`Error: ${errorMessage}`);
    }
    logInfo(infoMessage) {
        console.info(`Info: ${infoMessage}`);
    }
  }
const logger = new uploaderLogger()

const url = "${api_url}/pre-signed-url"; //API Gateway URL. Once API GAteway is called, the lambda is triggered which 
//carried out file validation and returns pre-signed URLs if files pass checks

const options = {
    method: 'GET',
}; //API Gateway will be called with GET method
    
let form = document.getElementById("form");
form.addEventListener("submit", onSubmit);
    
 //Once user submits both files, the below function pings the API Gateway with the parameters needed.   
async function onSubmit(event) {

    //move this check to lambda (future reference)
    
    event.preventDefault(); //prvents the form being submitted the usual way. 
    if (form.fileOne.files.length < 1 || form.fileTwo.files.length < 1) { //checks if user has added 2 files (this is the only validation done client side)
	window.location.href = "error.html";
            return false;
        }
        
    const fileOne = form.fileOne.files[0]; //First file chosen (EXTRACT file)
    const fileTwo = form.fileTwo.files[0]; //Second file chosen (MANI file)

    const urlWithParameters = url + `?fileOneName=$${fileOne.name}&fileOneType=$${fileOne.type}&fileTwoName=$${fileTwo.name}&fileTwoType=$${fileTwo.type}&fileOneSize=$${fileOne.size}&fileTwoSize=$${fileTwo.size}`;

    

    fetch(urlWithParameters, options) //pings API Gateway which triggers lambda. File verification is carried out by lambda - the message in the reponse depeneds on if and why the files fail the checks
        .then(response => response.json())    
        .then(data => {   
            console.log("message : " + data.message)
            if(data.message === "file is incorrect type"){
		window.location.href = "error.html";
            logger.logError(data.message);
                
            }  else if(data.message === "file is empty") {
		window.location.href = "error.html";
            logger.logError(data.message);

            }   else if(data.message === "file names dont match") {
		window.location.href = "error.html";
            logger.logError(data.message); 

            }   else {
                uploadFile(data.uploadURLFileOne, fileOne).then(data => {   //If all file verification checks pass, each file is uploded to its individual pre-signed URL which puts file in s3 bucket
                })
                uploadFile(data.uploadURLFileTwo, fileTwo).then(data => {
                    window.location.href = "success.html"
                    logger.logInfo("file uploaded")
                })
            }
        });
       
}

async function uploadFile(uploadURL, file) {
console.log("uploading file " + file.name)
let uploadResponse = await fetch(uploadURL, {
    method: "PUT",
    body: file
        }).then(resp => {
            return resp.text().then(body => {
                
                const result = {
                    status: resp.status,
                    body,
                };
                if (!resp.ok) {
                    return Promise.reject(result);
                }
                return result;
             });
        });
}

(window);
    