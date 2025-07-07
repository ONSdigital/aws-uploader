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
When('I upload a correctly named non-zero byte extract file that matches the URL LAD code', async function () {
    let fileInput = await this.driver.findElement(By.id('fileOne'));
    const path = require('path');
    let filePath = path.resolve(process.cwd(), 'features/test_files/CTAX_EXTRACT_E00000000_20250131.csv');

    await fileInput.sendKeys(filePath);
});

When('I upload a correctly named non-zero byte manifest file that matches the URL LAD code', async function () {
    let fileInput = await this.driver.findElement(By.id('fileTwo'));
    const path = require('path');
    let filePath = path.resolve(process.cwd(), 'features/test_files/CTAX_MANI_E00000000_20250131.csv');

    await fileInput.sendKeys(filePath);
});

When('I upload an incorrectly named non-zero byte manifest file', async function () {
    let fileInput = await this.driver.findElement(By.id('fileTwo'));
    const path = require('path');
    let filePath = path.resolve(process.cwd(), 'features/test_files/CTAX_MANI_E00000000_202501.csv');

    await fileInput.sendKeys(filePath);
});

When('I upload an incorrectly named non-zero byte extract file', async function () {
    let fileInput = await this.driver.findElement(By.id('fileOne'));
    const path = require('path');
    let filePath = path.resolve(process.cwd(), 'features/test_files/CTAX_EXTRACT_E00000000_202501.csv');

    await fileInput.sendKeys(filePath);
});

When('I upload a non-zero byte manifest file that does not have a .csv extension', async function () {
    let fileInput = await this.driver.findElement(By.id('fileTwo'));
    const path = require('path');
    let filePath = path.resolve(process.cwd(), 'features/test_files/CTAX_MANI_E00000000_20250131');

    await fileInput.sendKeys(filePath);
});

When('I upload a non-zero byte extract file that does not have a .csv extension', async function () {
    let fileInput = await this.driver.findElement(By.id('fileOne'));
    const path = require('path');
    let filePath = path.resolve(process.cwd(), 'features/test_files/CTAX_EXTRACT_E00000000_20250131');

    await fileInput.sendKeys(filePath);
});

When('I upload a correctly named non-zero byte manifest file that does not match the URL LAD Code', async function () {
    let fileInput = await this.driver.findElement(By.id('fileTwo'));
    const path = require('path');
    let filePath = path.resolve(process.cwd(), 'features/test_files/CTAX_MANI_E00000001_20250131.csv');

    await fileInput.sendKeys(filePath);
});

When('I upload a correctly named non-zero byte extract file that does not match the URL LAD Code', async function () {
    let fileInput = await this.driver.findElement(By.id('fileOne'));
    const path = require('path');
    let filePath = path.resolve(process.cwd(), 'features/test_files/CTAX_EXTRACT_E00000001_20250131.csv');

    await fileInput.sendKeys(filePath);
});

When('I click "Submit"', async function () {
    const submitButton = await this.driver.findElement(By.className('ons-btn'));

    await submitButton.click();
});

// THEN //
Then('I should see the extract file input field', async function () {
    let extractFileInput = await this.driver.findElement(By.id('fileOne'));
    assert.ok(extractFileInput.isDisplayed());
});

Then('I should see the mani file input field', async function () {
    let extractFileInput = await this.driver.findElement(By.id('fileOne'));
    assert.ok(extractFileInput.isDisplayed());
});

Then('I should see the submit button', async function () {
    let submitButton = await this.driver.findElement(By.className('ons-btn'));
    assert.ok(submitButton.isDisplayed());
});

Then('I should see a "Success" message', async function () {
    await this.driver.wait(until.elementLocated(By.xpath('//*[contains(text(), "Success")]')), 5000);
    let pageText = await this.driver.findElement(By.tagName('body')).getText();

    assert.ok(pageText.includes("Success"), 'The text "Success" was not found on the page');
    assert.ok(pageText.includes("Information has been successfully submitted"), 'The text "Information has been successfully submitted" was not found on the page');
});

Then('I should see a "You need to fill in both fields" message', async function () {
    await this.driver.wait(until.elementLocated(By.xpath('//*[contains(text(), "You need to fill in both fields")]')), 5000);
    let pageText = await this.driver.findElement(By.tagName('body')).getText();

    assert.ok(pageText.includes("You need to fill in both fields"), 'The text "You need to fill in both fields" message" was not found on the page');
});

Then('I should see a “Mani File name does not follow the right pattern” message', async function () {
    await this.driver.wait(until.elementLocated(By.xpath('//*[contains(text(), "Mani File name does not follow the right pattern")]')), 5000);
    let pageText = await this.driver.findElement(By.tagName('body')).getText();

    assert.ok(pageText.includes("Mani File name does not follow the right pattern"), 'The text "Mani File name does not follow the right pattern" message was not found on the page');
});

Then('I should see a “Extract File name does not follow the right pattern” message', async function () {
    await this.driver.wait(until.elementLocated(By.xpath('//*[contains(text(), "Extract File name does not follow the right pattern")]')), 5000);
    let pageText = await this.driver.findElement(By.tagName('body')).getText();

    assert.ok(pageText.includes("Extract File name does not follow the right pattern"), 'The text "Extract File name does not follow the right pattern" message was not found on the page');
});

Then('I should see a “File name does not contain matching LAD code” message', async function () {
    await this.driver.wait(until.elementLocated(By.xpath('//*[contains(text(), "File name does not contain matching LAD code")]')), 5000);
    let pageText = await this.driver.findElement(By.tagName('body')).getText();

    assert.ok(pageText.includes("File name does not contain matching LAD code"), 'The text "File name does not contain matching LAD code" message was not found on the page');
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
