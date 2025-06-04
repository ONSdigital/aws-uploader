const assert = require('assert');
const { Given, When, Then } = require('@cucumber/cucumber');
const { By } = require('selenium-webdriver');
const { createDriver } = require('../support/webdriver'); // Import the WebDriver configuration

Given('I have navigated to the uploader page', async function () {
    let URL = "https://uploader.ingest-dev.aws.onsdigital.uk/council-tax/E00000000-Test&Test.html";

    this.driver = await createDriver();
    await this.driver.get(URL);
});

When('I upload an extract file', async function () {
    let fileInput = await this.driver.findElement(By.id('fileOne'));
    let filePath = '/Users/jameswilliams/IngestRepositories/aws-uploader/features/testFiles/CTAX_EXTRACT_E00000000_20250131.csv';

    await fileInput.sendKeys(filePath);
});

// Then('I should see "Council Tax - Test"', async function () {
//     let councilNameElement = await this.driver.findElement(By.id('council-name'));
//     let actualText = await councilNameElement.getText();
//     let pageText = await this.driver.findElement(By.tagName('body')).getText();

//     assert.strictEqual(actualText, "Council Tax - Test");
//     assert.ok(pageText.includes("Council Tax - Test"));
// });
