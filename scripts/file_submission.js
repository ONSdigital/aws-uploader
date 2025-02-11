const url = "${api_url}pre-signed-url"; // API Gateway URL. Once API Gateway is called, the lambda is triggered which
// carries out file validation and returns pre-signed URLs if files pass checks

const options = {
    method: 'GET',
}; // API Gateway will be called with GET method

let form = document.getElementById("form");
form.addEventListener("submit", onSubmit);

// Once user submits both files, the below function pings the API Gateway with the parameters needed.
async function onSubmit(event) {
    event.preventDefault(); // Prevents the form from being submitted the usual way.
    // Start of the submit function



    function commonErrorStyle(message){
        console.log(Number.isInteger(message))
        if (Number.isInteger(message)) {
            if (message==1) {
                displayText="There is 1 problem with this page"
            } else {
                displayText="There are "+message+" problems with this page"
            }
        } else {
            displayText=message
        }

        let extractManiFilesErrorTitle = document.getElementById('errors-list-title')
        let extractManiFileError = document.getElementById('errors-list')
        extractManiFileError.style.display = 'block';
        extractManiFilesErrorTitle.innerHTML = displayText;
    
    }


    function bothFilesErrorStyle() {
        let extractManiFilesErrorTitle = document.getElementById('errors-list-title')
        let extractFileError = document.getElementById('extract-file-error');
        let maniFileError = document.getElementById('mani-file-error');
        extractFileError.classList.add("ons-panel--error", "ons-panel--no-title");
        maniFileError.style.display = 'block';
        maniFileError.classList.add("ons-panel--error", "ons-panel--no-title");
        
    }

    function fileOneErrorStyle() {
        let extractFileCSVError = document.getElementById('extract-file-csv-error')
        let extractFileError = document.getElementById('extract-file-error');
        let extractManiFileError = document.getElementById('errors-list')
        extractFileError.classList.add("ons-panel--error", "ons-panel--no-title");
        extractFileCSVError.style.display = 'block';
    }

    function fileTwoErrorStyle() {
        let maniFileCSVError = document.getElementById('mani-file-csv-error')
        let maniFileError = document.getElementById('mani-file-error');
        maniFileError.style.display = 'block';
        maniFileError.classList.add("ons-panel--error", "ons-panel--no-title");
        maniFileCSVError.style.display = 'block';
    }

    function addItem(line, anchor) {
        olObj=document.getElementById("errors-list-item")
        olObj.innerHTML=olObj.innerHTML+"<li class='ons-list__item'><a class='ons-list__link ons-js-inpagelink' href='#"+anchor+"'>"+line+"</a></li>"
    }

    function clearErrors() {
        document.getElementById('errors-list').style.display="none"
        document.getElementById("errors-list-item").innerHTML=""
        let cls=document.getElementsByClassName("ons-panel--no-title")
        if (cls.length>0) {
            for (var i=0; i<cls.length; i++){
                cls[i].classList.remove("ons-panel--error", "ons-panel--no-title");
                }
        };
    } 


    clearErrors()

    let valid = true;
<<<<<<< HEAD
    let errCount=0;
    // if (!valid) {
    //     loadingSpinner.style.display = 'none';
    //     return false;
    // }

    if (form.fileOne.files.length < 1 ) {
        fileOneErrorStyle();
        addItem("You need to add a Extract file", "fileOne")
        valid=false;
    }
    if (form.fileTwo.files.length < 1 ) {
        fileTwoErrorStyle();
        addItem("You need to add a Mani file", "fileTwo")
        valid=false;
    }
    if (!valid) {
        commonErrorStyle("You need to fill in both fields")
        //if we don't have both then we're going to stop checking here.
        return(false)
    }

    const fileOne = form.fileOne.files[0]; // First file chosen (EXTRACT file)
    const fileTwo = form.fileTwo.files[0]; // Second file chosen (MANI file)

    // Extract code from the current URL
    const currentUrl = window.location.href;
    const urlParts = currentUrl.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    const ladCode = lastPart.split('-')[0];
    console.log("URL Code found: ", ladCode);
    
    const patOne=new RegExp("CTAX_EXTRACT_"+ladCode+"_.{8}\.csv","i")
    console.log(patOne)
    if (!fileOne.name.includes(ladCode)) {
        console.log("File name does not contain matching code:", fileOne.name);
        fileOneErrorStyle();
        addItem("File name does not contain matching LAD code", "fileOne")
        valid=false;
        errCount=++errCount;
    }

    if (fileOne.name.includes(ladCode) && !fileOne.name.match(patOne)) {
        console.log("Extract File name does not follow the right pattern", fileOne.name);
        fileOneErrorStyle();
        addItem("Extract File name does not follow the right pattern", "fileOne")
        valid=false;
        errCount=++errCount;
    }

    const patTwo=new RegExp("CTAX_MANI_"+ladCode+"_\d{8}\.csv","i")
   

    if (!fileTwo.name.includes(ladCode)) {
        console.log("File name does not contain matching code:", fileTwo.name);
        fileTwoErrorStyle();
        addItem("File name does not contain matching LAD code", "fileTwo")
        valid=false;
        errCount=++errCount;
    }

    if (fileTwo.name.includes(ladCode) && !fileTwo.name.match(patTwo)) {
        console.log("ManiFile name does not follow the right pattern", fileTwo.name);
        fileOneErrorStyle();
        addItem("Mani File name does not follow the right pattern", "fileTwo")
        valid=false;
        errCount=++errCount;
    }

    if (!valid) { 
        commonErrorStyle(errCount);
        return false;
    }


    const loadingSpinner = document.querySelector('.hods-loading-spinner__content');
    loadingSpinner.style.display = 'block';
    const urlWithParameters = url + `?fileOneName=$${fileOne.name}&fileOneType=$${fileOne.type}&fileTwoName=$${fileTwo.name}&fileTwoType=$${fileTwo.type}&fileOneSize=$${fileOne.size}&fileTwoSize=$${fileTwo.size}`;

    fetch(urlWithParameters, options) // Pings API Gateway which triggers lambda. File verification is carried out by lambda - the message in the response depends on if and why the files fail the checks
        .then(response => response.json())
        .then(data => {
            console.log("message : " + data.message);
            if (data.message === "File is not .csv") {
                fileOneErrorStyle();
                addItem("Please upload a CSV file", "fileOne")
                commonErrorStyle(1);
            }  else if (data.message === "maniFile is not .csv") {
                fileTwoErrorStyle();
                addItem("Please upload a CSV file", "fileTwo")
                commonErrorStyle(1);
             } else if (data.message === "File is empty") {
                bothFilesErrorStyle()
                addItem("Extract file is empty", "fileOne")
                addItem("Mani file is empty", "fileTwo")
                commonErrorStyle(2);
            } else if (data.message === "File names do not match") {
                bothFilesErrorStyle()
                addItem("File names do not match", "fileOne")
                commonErrorStyle(2);
            } else {
                uploadFile(data.uploadURLFileOne, fileOne).then(data => { // If all file verification checks pass, each file is uploaded to its individual pre-signed URL which puts file in s3 bucket
                });
                uploadFile(data.uploadURLFileTwo, fileTwo).then(data => {
                    window.location.href = "success.html";
                });
            }
            loadingSpinner.style.display = "none"
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
