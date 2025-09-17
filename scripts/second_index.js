async function handler(event) {
    var request = event.request;
    var uri = decodeURIComponent(request.uri);
    
    // Check whether the URI is missing a file name.
    if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
    } 
    // Check whether the URI is missing a file extension.
    else if (!uri.includes('.')) {
        request.uri = uri + '/index.html';
    }
    else {
        request.uri = uri;
    }

    return request;
}
