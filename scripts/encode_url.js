function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Split URI into path and query string
    var parts = uri.split('?');
    var path = parts[0];
    var queryString = parts[1];

    // Encode each path segment while preserving forward slashes
    var encodedPath = path.split('/').map(function(segment) {
        return encodeURIComponent(segment);
    }).join('/');

    // Reconstruct URI
    request.uri = queryString ? encodedPath + '?' + queryString : encodedPath;

    return request;
}