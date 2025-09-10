function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Decode the URI first to handle any pre-encoded characters
    var decodedUri = decodeURIComponent(uri);

    // Encode only the path and query string
    var encodedUri = decodedUri.split('?').map((part, index) => {
        return index === 0 ? encodeURIComponent(part) : part; // Only encode the path, not the query string
    }).join('?');

    request.uri = encodedUri;

    return request;
}