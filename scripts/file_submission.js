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
    // Show the loading spinner
    const loadingSpinner = document.querySelector('.hods-loading-spinner__content');
    loadingSpinner.style.display = 'block';

    let extractUpload = document.getElementById('extract-upload-error');
    let maniUpload = document.getElementById('mani-upload');
    let extractFileError = document.getElementById('extract-file-error');
    let maniFileError = document.getElementById('mani-file-error');
    let valid = true;
    let extractFileErrorText = document.getElementById('extract-file-error-text')
    let extractFileCSVError = document.getElementById('extract-file-csv-error')
    let maniFileErrorText = document.getElementById('mani-file-error-text')
    let maniFileCSVError = document.getElementById('mani-file-csv-error')
    // extractFileError.classList.add("ons-panel--error", "ons-panel--no-title")
    // extractFileErrorText.innerHTML = "Please upload a CSV file"
    // extractFileCSVError.style.display = 'block'
    // Reset error messages
    // extractFileError.style.display = 'none';
    // maniFileError.style.display = 'none';

    // Validate extract-upload file
    if (extractUpload.files.length > 0) {
        let extractFile = extractUpload.files[0];
        if (extractFile.type !== 'text/csv') {
            extractFileError.style.display = 'block';
            extractFileError.classList.add("ons-panel--error", "ons-panel--no-title");
            extractFileErrorText.innerHTML = "Please upload a CSV file";
            extractFileCSVError.style.display = 'block';
            valid = false;
        }
    }

    // Validate mani-upload file
    if (maniUpload.files.length > 0) {
        let maniFile = maniUpload.files[0];
        if (maniFile.type !== 'text/csv') {
            maniFileError.style.display = 'block';
            maniFileError.classList.add("ons-panel--error", "ons-panel--no-title");
            maniFileErrorText.innerHTML = "Please upload a CSV file";
            maniFileCSVError.style.display = 'block';
            valid = false;
        }
    }

    if (!valid) {
        loadingSpinner.style.display = 'none';
        return false;
    }

    if (form.fileOne.files.length < 1 || form.fileTwo.files.length < 1) { // Checks if user has added 2 files (this is the only validation done client side)
        window.location.href = "error.html";
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
        window.location.href = "LAD_doesnt_match.html";
        return false;
    }

    if (!fileTwo.name.includes(ladCode)) {
        console.log("File name does not contain matching code:", fileTwo.name);
        window.location.href = "LAD_doesnt_match.html";
        return false;
    }

    const urlWithParameters = url + `?fileOneName=$${fileOne.name}&fileOneType=$${fileOne.type}&fileTwoName=$${fileTwo.name}&fileTwoType=$${fileTwo.type}&fileOneSize=$${fileOne.size}&fileTwoSize=$${fileTwo.size}`;

    fetch(urlWithParameters, options) // Pings API Gateway which triggers lambda. File verification is carried out by lambda - the message in the response depends on if and why the files fail the checks
        .then(response => response.json())
        .then(data => {
            console.log("message : " + data.message);
            if (data.message === "file is incorrect type") {
                window.location.href = "not_CSV_error.html";
            } else if (data.message === "File is empty") {
                window.location.href = "empy_file_error.html";
            } else if (data.message === "file names dont match") {
                window.location.href = "file_names_dont_match_error.html";
            } else {
                uploadFile(data.uploadURLFileOne, fileOne).then(data => { // If all file verification checks pass, each file is uploaded to its individual pre-signed URL which puts file in s3 bucket
                });
                uploadFile(data.uploadURLFileTwo, fileTwo).then(data => {
                    window.location.href = "success.html";
                });
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
