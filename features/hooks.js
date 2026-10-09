const { After, setDefaultTimeout } = require("@cucumber/cucumber");

// Raise the default per-step timeout from cucumber's built-in 5s. Steps that
// spin up a headless Chrome and fetch a page over the network (the navigation
// Given) can legitimately exceed 5s on a cold CloudFront edge or under CI load,
// which caused intermittent "function timed out" failures. 30s gives ample
// headroom without masking a genuinely hung step.
setDefaultTimeout(30000);

After(async function () {
  if (this.driver) {
    await this.driver.quit(); // Close the WebDriver instance
  }
});
