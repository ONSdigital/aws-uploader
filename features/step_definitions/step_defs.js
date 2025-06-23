const assert = require('assert');
const { Given, When, Then } = require('@cucumber/cucumber');
const { By } = require('selenium-webdriver');
const { createDriver } = require('../support/webdriver'); // Import the WebDriver configuration
const { until } = require('selenium-webdriver');

// GIVEN //
Given('I have navigated to the uploader page', async function () {
    let URL = "https://uploader.ingest-dev.aws.onsdigital.uk/council-tax/E00000000-Test.html";

    this.driver = await createDriver();
    await this.driver.get(URL);
});

//WHEN //
When('I upload an extract file', async function () {
    let fileInput = await this.driver.findElement(By.id('fileOne'));
    const path = require('path');
    let filePath = path.resolve(process.cwd(), 'features/test_files/CTAX_EXTRACT_E00000000_20250131.csv');

    await fileInput.sendKeys(filePath);
});

When('I upload a manifest file', async function () {
    let fileInput = await this.driver.findElement(By.id('fileTwo'));
    const path = require('path');
    let filePath = path.resolve(process.cwd(), 'features/test_files/CTAX_MANI_E00000000_20250131.csv');

    await fileInput.sendKeys(filePath);
});

When('I click "Submit"', async function () {
    const submitButton = await this.driver.findElement(By.className('ons-btn'));

    await submitButton.click();
});

// THEN //
Then('I should see a "Success" message', async function () {
    await this.driver.wait(until.elementLocated(By.xpath('//*[contains(text(), "Success")]')), 5000);
    let pageText = await this.driver.findElement(By.tagName('body')).getText();

    assert.ok(pageText.includes("Success"), 'The text "Success" was not found on the page');
    assert.ok(pageText.includes("Information has been successfully submitted"), 'The text "Information has been successfully submitted" was not found on the page');
});

Then('I should see a "You need to fill in both fields" message', async function () {
    await this.driver.wait(until.elementLocated(By.xpath('//*[contains(text(), "You need to fill in both fields")]')), 5000);
    let pageText = await this.driver.findElement(By.tagName('body')).getText();

    assert.ok(pageText.includes("You need to fill in both fields"), 'The text "YI should see a "You need to fill in both fields" message" was not found on the page');
});

Then('I should see a "You need to add a Mani file" message', async function () {
    await this.driver.wait(until.elementLocated(By.xpath('//*[contains(text(), "You need to add a Mani file")]')), 5000);
    let pageText = await this.driver.findElement(By.tagName('body')).getText();

    assert.ok(pageText.includes("You need to add a Mani file"), 'The text "You need to add a Mani file" was not found on the page');
});

Then('I should see a "You need to add a Extract file" message', async function () {
    await this.driver.wait(until.elementLocated(By.xpath('//*[contains(text(), "You need to add a Extract file")]')), 5000);
    let pageText = await this.driver.findElement(By.tagName('body')).getText();

    assert.ok(pageText.includes("You need to add a Extract file"), 'The text "You need to add a Extract file" was not found on the page');
});
