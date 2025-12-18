async function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Decode percent-encoded URLs and normalize special characters
  try {
    uri = decodeURIComponent(uri);
    // Remove special characters to match S3 object keys (same logic as Terraform)
    uri = uri.replace(/[^A-Za-z0-9\-_ \/\.]/g, "");
    request.uri = uri;
  } catch (e) {
    // If decoding fails, continue with original URI
  }

  // Check whether the URI is missing a file name.
  if (uri.endsWith("/")) {
    request.uri += "index.html";
  }
  // Check whether the URI is missing a file extension.
  else if (!uri.includes(".")) {
    request.uri += "/index.html";
  }

  return request;
}
