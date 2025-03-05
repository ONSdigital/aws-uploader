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
              throw new Error(`Failed to upload part $${part.partNumber}`);  // Escaped ${
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
  // Previous validation code remains the same

  const urlWithParameters = url + `?fileOneName=$${fileOne.name}&fileOneType=$${fileOne.type}&fileTwoName=$${fileTwo.name}&fileTwoType=$${fileTwo.type}&fileOneSize=$${fileOne.size}&fileTwoSize=$${fileTwo.size}`;  // Escaped ${

  try {
      const response = await fetch(urlWithParameters, options);
      const data = await response.json();

      if (data.message === "File is not .csv") {
          // Error handling code remains the same
      } else {
          // Handle multipart uploads
          const [fileOneUploadResults, fileTwoUploadResults] = await Promise.all([
              uploadFile(data.fileOne, fileOne),
              uploadFile(data.fileTwo, fileTwo)
          ]);

          // Call completion endpoint to finalize the uploads
          const completionResponse = await fetch(`$${api_url}complete-multipart`, {  // Escaped ${
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
