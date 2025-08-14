function handler(event) {
    var request = event.request;
    var url = request.url; // Use `url` instead of `uri`

    // Parse the URL into components
    var urlParts = url.split('?');
    var baseUrl = urlParts[0];
    var queryString = urlParts[1];

    // Encode each path segment while preserving forward slashes
    var encodedBaseUrl = baseUrl.split('/').map(function(segment) {
        return encodeURIComponent(segment);
    }).join('/');

    // Reconstruct the full URL
    request.url = queryString ? encodedBaseUrl + '?' + queryString : encodedBaseUrl;

    return request;
}