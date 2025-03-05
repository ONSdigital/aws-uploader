const url = "${api_url}pre-signed-url"; // API Gateway URL. Once API Gateway is called, the lambda is triggered which
// carries out file validation and returns pre-signed URLs if files pass checks

const options = {
    method: 'GET',
}; 

let form = document.getElementById("form");
form.addEventListener("submit", onSubmit);

function commonErrorStyle(message) {
    console.log(Number.isInteger(message))
    if (Number.isInteger(message)) {
        if (message == 1) {
            displayText = "There is 1 problem with this page"
        } else {
            displayText = "There are " + message + " problems with this page"
        }
    } else {
        displayText = message
    }

    let extractManiFilesErrorTitle = document.getElementById('errors-list-title')
    let extractManiFileError = document.getElementById('errors-list')
    extractManiFileError.style.display = 'block';
    extractManiFilesErrorTitle.innerHTML = displayText;
}

function bothFilesErrorStyle() {
    let extractFileError = document.getElementById('extract-file-error');
    let maniFileError = document.getElementById('mani-file-error');
    extractFileError.classList.add("ons-panel--error", "ons-panel--no-title");
    maniFileError.style.display = 'block';
    maniFileError.classList.add("ons-panel--error", "ons-panel--no-title");
}

function fileOneErrorStyle() {
    let extractFileCSVError = document.getElementById('extract-file-csv-error')
    let extractFileError = document.getElementById('extract-file-error');
    extractFileError.classList.add("ons-panel--error", "ons-panel--no-title");
    extractFileCSVError.style.display = 'block';
}

function fileTwoErrorStyle() {
    let maniFileCSVError = document.getElementById('mani-file-csv-error')
    let maniFileError = document.getElementById('mani-file-error');
    maniFileError.classList.add("ons-panel--error", "ons-panel--no-title");
    maniFileCSVError.style.display = 'block';
}

function addItem(line, anchor) {
    olObj = document.getElementById("errors-list-item")
    olObj.innerHTML = olObj.innerHTML + "<li class='ons-list__item'><a class='ons-list__link ons-js-inpagelink' href='#" + anchor + "'>" + line + "</a></li>"
}

function clearErrors() {
    document.getElementById('errors-list').style.display = "none"
    document.getElementById("errors-list-item").innerHTML = ""
    let cls = document.getElementsByClassName("ons-panel--no-title")
    if (cls.length > 0) {
        for (var i = 0; i < cls.length; i++) {
            cls[i].classList.remove("ons-panel--error", "ons-panel--no-title");
        }
    };
}

async function uploadFile(uploadURL, file) {
    // Calculate the optimal chunk size (40MB)
    const CHUNK_SIZE = 40 * 1024 * 1024; // 40MB in bytes
    const fileSize = file.size;
    const chunks = [];

    // Split file into chunks
    let start = 0;
    while (start < fileSize) {
        const end = Math.min(start + CHUNK_SIZE, fileSize);
        chunks.push(file.slice(start, end));
        start = end;
    }

    try {
        // Upload each chunk using the provided URLs
        const uploadPromises = uploadURL.partUrls.map(async (part, index) => {
            const chunk = chunks[index];
            if (!chunk) return null;

            const uploadResponse = await fetch(part.url, {
                method: "PUT",
                body: chunk
            });

            if (!uploadResponse.ok) {
                throw new Error(`Failed to upload part ${part.partNumber}`);
            }

            // Get the ETag from the response headers
            const eTag = uploadResponse.headers.get('ETag');
            return {
                PartNumber: part.partNumber,
                ETag: eTag
            };
        });

        const results = await Promise.all(uploadPromises);
        return results.filter(result => result !== null);

    } catch (error) {
        console.error('Error during multipart upload:', error);
        throw error;
    }
}

async function onSubmit(event) {
    event.preventDefault();
    clearErrors();

    let valid = true;
    let errCount = 0;

    if (form.fileOne.files.length < 1) {
        fileOneErrorStyle();
        addItem("You need to add a Extract file", "fileOne");
        valid = false;
    }
    if (form.fileTwo.files.length < 1) {
        fileTwoErrorStyle();
        addItem("You need to add a Mani file", "fileTwo");
        valid = false;
    }
    if (!valid) {
        commonErrorStyle("You need to fill in both fields");
        return false;
    }

    const fileOne = form.fileOne.files[0];
    const fileTwo = form.fileTwo.files[0];

    // Extract code from the current URL
    const currentUrl = window.location.href;
    const urlParts = currentUrl.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    const ladCode = lastPart.split('-')[0];
    console.log("URL Code found: ", ladCode);
    console.log("File name is:", fileOne.name);

    const patOne = new RegExp("CTAX_EXTRACT_" + ladCode + '_\\d{8}\\.csv', "i");
    console.log(patOne);
    if (!fileOne.name.includes(ladCode)) {
        console.log("File name does not contain matching code:", fileOne.name);
        fileOneErrorStyle();
        addItem("File name does not contain matching LAD code", "fileOne");
        valid = false;
        errCount = ++errCount;
    }

    if (fileOne.name.includes(ladCode) && !fileOne.name.match(patOne)) {
        console.log("Extract File name does not follow the right pattern", fileOne.name);
        fileOneErrorStyle();
        addItem("Extract File name does not follow the right pattern", "fileOne");
        valid = false;
        errCount = ++errCount;
    }

    const patTwo = new RegExp("CTAX_MANI_" + ladCode + '_\\d{8}\\.csv', "i");

    if (!fileTwo.name.includes(ladCode)) {
        console.log("File name does not contain matching code:", fileTwo.name);
        fileTwoErrorStyle();
        addItem("File name does not contain matching LAD code", "fileTwo");
        valid = false;
        errCount = ++errCount;
    }

    if (fileTwo.name.includes(ladCode) && !fileTwo.name.match(patTwo)) {
        console.log("ManiFile name does not follow the right pattern", fileTwo.name);
        fileTwoErrorStyle();
        addItem("Mani File name does not follow the right pattern", "fileTwo");
        valid = false;
        errCount = ++errCount;
    }

    if (!valid) {
        commonErrorStyle(errCount);
        return false;
    }

    const loadingSpinner = document.querySelector('.hods-loading-spinner__content');
    loadingSpinner.style.display = 'block';

    const urlWithParameters = url + `?fileOneName=${fileOne.name}&fileOneType=${fileOne.type}&fileTwoName=${fileTwo.name}&fileTwoType=${fileTwo.type}&fileOneSize=${fileOne.size}&fileTwoSize=${fileTwo.size}`;

    try {
        const response = await fetch(urlWithParameters, options);
        const data = await response.json();

        if (data.message === "File is not .csv") {
            fileOneErrorStyle();
            addItem("Please upload a CSV file", "fileOne");
            commonErrorStyle(1);
        } else if (data.message === "maniFile is not .csv") {
            fileTwoErrorStyle();
            addItem("Please upload a CSV file", "fileTwo");
            commonErrorStyle(1);
        } else if (data.message === "File is empty") {
            bothFilesErrorStyle();
            addItem("Extract file is empty", "fileOne");
            addItem("Mani file is empty", "fileTwo");
            commonErrorStyle(2);
        } else if (data.message === "File names do not match") {
            bothFilesErrorStyle();
            addItem("File names do not match", "fileOne");
            commonErrorStyle(2);
        } else {
            // Handle multipart uploads
            const [fileOneUploadResults, fileTwoUploadResults] = await Promise.all([
                uploadFile(data.fileOne, fileOne),
                uploadFile(data.fileTwo, fileTwo)
            ]);

            // Call completion endpoint to finalize the uploads
            const completionResponse = await fetch(`${api_url}complete-multipart`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fileOne: {
                        uploadId: data.fileOne.uploadId,
                        key: data.fileOne.key,
                        parts: fileOneUploadResults
                    },
                    fileTwo: {
                        uploadId: data.fileTwo.uploadId,
                        key: data.fileTwo.key,
                        parts: fileTwoUploadResults
                    }
                })
            });

            if (!completionResponse.ok) {
                throw new Error('Failed to complete multipart upload');
            }

            loadingSpinner.style.display = "none";
            window.location.href = "success.html";
        }
    } catch (error) {
        loadingSpinner.style.display = "none";
        console.error('Error uploading files:', error);
        bothFilesErrorStyle();
        addItem("There has been an issue with the upload, please contact ingest.service@ons.gov.uk", "fileOne");
        commonErrorStyle(2);
    }
}

(window);
