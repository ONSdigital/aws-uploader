async function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    // For council-tax pages, decode URL-encoded characters to match S3 object keys
    if (uri.startsWith('/council-tax/')) {
        request.uri = decodeURIComponent(uri);
    }
    // Check whether the URI is missing a file name.
    else if (uri.endsWith('/')) {
        request.uri += 'index.html';
    } 
    // Check whether the URI is missing a file extension.
    else if (!uri.includes('.')) {
        request.uri += '/index.html';
    }

    return request;
}
