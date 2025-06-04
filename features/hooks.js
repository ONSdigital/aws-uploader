const { After } = require('@cucumber/cucumber');

After(async function () {
    if (this.driver) {
        await this.driver.quit(); // Close the WebDriver instance
    }
});
