// API Configuration
console.log('file_submission.js loaded - version with date comparison');
const url = '${api_url}pre-signed-url';
const options = {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

// Helper functions
function extractCouncilNameFromURL(urlPart) {
    const parts = urlPart.split('-');
    parts.shift(); // Remove LAD code
    return parts.join('-').replace('.html', '');
}

function commonErrorStyle(errorCount) {
    const errorsList = document.getElementById('errors-list');
    const errorsTitle = document.getElementById('errors-list-title');
    const errorsParagraph = document.getElementById('errors-list-paragraph');
    const errorsText = document.getElementById('errors-list-text');
    
    errorsList.style.display = 'block';
    errorsParagraph.style.display = 'block';
    
    if (errorCount === 1) {
        errorsTitle.innerHTML = '<h2 class="ons-panel__title ons-u-fs-r--b">There is 1 problem with your answer</h2>';
        errorsText.textContent = 'There is 1 problem with your answer';
    } else {
        errorsTitle.innerHTML = `<h2 class="ons-panel__title ons-u-fs-r--b">There are $${errorCount} problems with your answer</h2>`;
        errorsText.textContent = `There are $${errorCount} problems with your answer`;
    }
}

function bothFilesErrorStyle() {
    let extractFileError = document.getElementById('extract-file-error');
    let maniFileError = document.getElementById('mani-file-error');
    extractFileError.classList.add("ons-panel--error", "ons-panel--no-title");
    maniFileError.style.display = 'block';
    maniFileError.classList.add("ons-panel--error", "ons-panel--no-title");
}

function fileOneErrorStyle() {
    let extractFileCSVError = document.getElementById('extract-file-csv-error');
    let extractFileError = document.getElementById('extract-file-error');
    extractFileError.classList.add("ons-panel--error", "ons-panel--no-title");
    extractFileCSVError.style.display = 'block';
}

function fileTwoErrorStyle() {
    let maniFileCSVError = document.getElementById('mani-file-csv-error');
    let maniFileError = document.getElementById('mani-file-error');
    maniFileError.classList.add("ons-panel--error", "ons-panel--no-title");
    maniFileCSVError.style.display = 'block';
}

function addItem(line, anchor) {
    olObj = document.getElementById("errors-list-item");
    olObj.innerHTML = olObj.innerHTML + "<li class='ons-list__item'><a class='ons-list__link ons-js-inpagelink' href='#" + anchor + "'>" + line + "</a></li>";
}

function clearErrors() {
    document.getElementById('errors-list').style.display = "none";
    document.getElementById("errors-list-item").innerHTML = "";
    let cls = document.getElementsByClassName("ons-panel--no-title");
    if (cls.length > 0) {
        for (var i = 0; i < cls.length; i++) {
            cls[i].classList.remove("ons-panel--error", "ons-panel--no-title");
        }
    }
}

// Form submission handler
document.getElementById('form').addEventListener('submit', function(e) {
    e.preventDefault();
    const form = this;
    
    clearErrors();

    let valid = true;
    let errCount = 0;

    if (form.fileOne.files.length < 1 || form.fileTwo.files.length < 1) {
        addItem("You need to fill in both fields", "fileOne");
        valid = false;
        errCount++;
    }
    if (form.fileOne.files.length < 1) {
        fileOneErrorStyle();
        addItem("You need to add a Extract file", "fileOne");
        valid = false;
        errCount++;
    }
    if (form.fileTwo.files.length < 1) {
        fileTwoErrorStyle();
        addItem("You need to add a Mani file", "fileTwo");
        valid = false;
        errCount++;
    }
    if (!valid) {
        commonErrorStyle(errCount);
        return false;
    }

    const fileOne = form.fileOne.files[0];
    const fileTwo = form.fileTwo.files[0];
    const currentUrl = window.location.href;
    const urlParts = currentUrl.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    const ladCode = lastPart.split('-')[0];
    let Council_name = extractCouncilNameFromURL(lastPart);

    Council_name = encodeURIComponent(Council_name);

    console.log("URL Code found: ", ladCode);
    console.log("File name is:", fileOne.name);
    console.log("Council name is:", Council_name);
    
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

    // Extract dates from filenames and compare
    const fileOneDate = fileOne.name.match(/\d{8}\.csv/)?.[0]?.replace('.csv', '');
    const fileTwoDate = fileTwo.name.match(/\d{8}\.csv/)?.[0]?.replace('.csv', '');
    
    if (fileOneDate && fileTwoDate && fileOneDate !== fileTwoDate) {
        bothFilesErrorStyle();
        addItem("File names do not match", "fileOne");
        commonErrorStyle(1);
        return false;
    }

    const loadingSpinner = document.querySelector('.hods-loading-spinner__content');
    loadingSpinner.style.display = 'block';
    const urlWithParameters = url + `?fileOneName=$${fileOne.name}&fileOneType=$${fileOne.type}&fileTwoName=$${fileTwo.name}&fileTwoType=$${fileTwo.type}&fileOneSize=$${fileOne.size}&fileTwoSize=$${fileTwo.size}&councilName=$${Council_name}`;

    fetch(urlWithParameters, options)
        .then(response => response.json())
        .then(data => {
            console.log("message : " + data.message);
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
                Promise.all([
                    uploadFile(data.fileOneUpload, fileOne),
                    uploadFile(data.fileTwoUpload, fileTwo)
                ])
                    .then(results => {
                        loadingSpinner.style.display = "none";
                        window.location.href = "success.html";
                    })
                    .catch(error => {
                        loadingSpinner.style.display = "none";
                        console.error('Error uploading files:', error);
                        bothFilesErrorStyle();
                        addItem("There has been an issue with the upload, please contact ingest.service@ons.gov.uk", "fileOne");
                        commonErrorStyle(2);
                    });
            }
        });
});

async function uploadFile(uploadData, file) {
    console.log("uploading file " + file.name);
    
    if (uploadData.multipart) {
        return await uploadMultipartFile(uploadData, file);
    } else {
        return await fetch(uploadData.uploadURL, {
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
}

async function uploadMultipartFile(uploadData, file) {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const parts = [];
    
    for (let i = 0; i < uploadData.parts.length; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        const response = await fetch(uploadData.parts[i].uploadURL, {
            method: "PUT",
            body: chunk,
            headers: {
                'Content-Type': 'application/octet-stream'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to upload part $${i + 1}`);
        }
        
        const etag = response.headers.get('ETag');
        if (!etag) {
            throw new Error(`No ETag received for part $${i + 1}`);
        }
        
        parts.push({
            ETag: etag,
            PartNumber: uploadData.parts[i].PartNumber
        });
    }
    
    // Complete multipart upload
    const completeResponse = await fetch(uploadData.completeURL, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ parts })
    });
    
    if (!completeResponse.ok) {
        const errorText = await completeResponse.text();
        throw new Error(`Failed to complete multipart upload: $${errorText}`);
    }
    
    return { status: completeResponse.status };
}