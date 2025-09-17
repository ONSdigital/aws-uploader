function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Split URI into path and query string
    var parts = uri.split('?');
    var path = parts[0];
    var queryString = parts[1];

    // Encode each path segment while preserving forward slashes
    // This handles special characters from HTML pages like spaces, apostrophes, etc.
    var encodedPath = path.split('/').map(function(segment) {
        // Only encode if segment is not empty (to avoid encoding root path)
        return segment ? encodeURIComponent(decodeURIComponent(segment)) : segment;
    }).join('/');

    // Reconstruct URI
    request.uri = queryString ? encodedPath + '?' + queryString : encodedPath;

    return request;
}
