function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Encode the URI
    request.uri = encodeURIComponent(decodeURIComponent(uri));

    return request;
}