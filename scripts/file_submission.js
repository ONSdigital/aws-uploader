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

    function bothFilesErrorStyle(displayText) {
        let extractManiFilesErrorTitle = document.getElementById('errors-list-title')
        let extractManiFileError = document.getElementById('errors-list')
        let extractFileError = document.getElementById('extract-file-error');
        let maniFileError = document.getElementById('mani-file-error');
        let valid = true;
        extractManiFileError.style.display = 'block';
        extractFileError.classList.add("ons-panel--error", "ons-panel--no-title");
        extractManiFilesErrorTitle.innerHTML = displayText;
        extractManiFileError.style.display = 'block';
        valid = false;
        maniFileError.style.display = 'block';
        maniFileError.classList.add("ons-panel--error", "ons-panel--no-title");
        valid = false;
    }

    function fileOneErrorStyle(displayText) {
        let extractManiFilesErrorTitle = document.getElementById('errors-list-title')
        let extractFileCSVError = document.getElementById('extract-file-csv-error')
        let extractFileError = document.getElementById('extract-file-error');
        let extractManiFileError = document.getElementById('errors-list')
        extractManiFileError.style.display = 'block';
        extractFileError.style.display = 'block';
        extractFileError.classList.add("ons-panel--error", "ons-panel--no-title");
        extractManiFilesErrorTitle.innerHTML = displayText;
        extractFileCSVError.style.display = 'block';
        valid = false;
    }

    function fileTwoErrorStyle(displayText) {
        let extractManiFilesErrorTitle = document.getElementById('errors-list-title')
        let maniFileCSVError = document.getElementById('mani-file-csv-error')
        let maniFileError = document.getElementById('mani-file-error');
        let extractManiFileError = document.getElementById('errors-list')
        extractManiFileError.style.display = 'block';
        maniFileError.style.display = 'block';
        maniFileError.classList.add("ons-panel--error", "ons-panel--no-title");
        extractManiFilesErrorTitle.innerHTML = displayText;
        maniFileCSVError.style.display = 'block';
        valid = false;
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

    if (form.fileOne.files.length < 1 || form.fileTwo.files.length < 1) { // Checks if user has added 2 files (this is the only validation done client side)
        bothFilesErrorStyle("You need to fill in both fields")
        addItem("You need to add a Extract file", "fileOne")
        addItem("You need to add a Mani file", "fileTwo")
        return false;
    }

    const fileOne = form.fileOne.files[0]; // First file chosen (EXTRACT file)
    const fileTwo = form.fileTwo.files[0]; // Second file chosen (MANI file)

    // Extract code from the current URL
    const currentUrl = window.location.href;
    const urlParts = currentUrl.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    const ladCode = lastPart.split('-')[0];
    console.log("URL Code found: ", ladCode);

    if (!fileOne.name.includes(ladCode)) {
        console.log("File name does not contain matching code:", fileOne.name);
        fileOneErrorStyle("There is 1 problem with this page");
        addItem("File name does not contain matching LAD code", "fileOne")
        return false;
    }

    if (!fileTwo.name.includes(ladCode)) {
        console.log("File name does not contain matching code:", fileTwo.name);
        fileTwoErrorStyle("There is 1 problem with this page");
        addItem("File name does not contain matching LAD code", "fileTwo")
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
                fileOneErrorStyle("There is 1 problem with this page");
                addItem("Please upload a CSV file", "fileOne")

            }  else if (data.message === "maniFile is not .csv") {
                fileTwoErrorStyle("There is 1 problem with this page");
                addItem("Please upload a CSV file", "fileTwo")
            
             } else if (data.message === "File is empty") {
                bothFilesErrorStyle("There are 2 problems with this page")
                addItem("Excract file is empty", "fileOne")
                addItem("Mani file is empty", "fileTwo")

            } else if (data.message === "File names do not match") {
                bothFilesErrorStyle("There is 1 problem with this page")
                addItem("File names do not match", "fileOne")

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
