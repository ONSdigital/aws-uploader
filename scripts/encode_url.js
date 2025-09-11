function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Parse URI components
    var parts = uri.split('?');
    var path = parts[0];
    var queryString = parts[1];

    // Encode path segments
    var encodedPath = path.split('/').map(function(segment) {
        return encodeURIComponent(segment);
    }).join('/');

    // Generate hash from the original URI
    var hash = simpleHash(uri);
    
    // Add hash as query parameter
    var hashParam = 'h=' + hash;
    var finalQuery = queryString ? queryString + '&' + hashParam : hashParam;
    
    request.uri = encodedPath + '?' + finalQuery;
    
    return request;
}

function simpleHash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}
