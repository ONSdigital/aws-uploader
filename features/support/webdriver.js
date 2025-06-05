const { Builder, Browser } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function createDriver() {
    let chromeOptions = new chrome.Options();
    chromeOptions.addArguments('--headless'); // Run in headless mode
    chromeOptions.addArguments('--disable-gpu'); // Disable GPU acceleration (optional)
    chromeOptions.addArguments('--window-size=1920,1080'); // Set window size (optional)

    // Initialize and return the WebDriver instance
    return await new Builder()
        .forBrowser(Browser.CHROME)
        .setChromeOptions(chromeOptions)
        .build();
}

module.exports = { createDriver };
