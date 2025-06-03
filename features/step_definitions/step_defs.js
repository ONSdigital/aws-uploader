const assert = require('assert');
const { Given, When, Then } = require('@cucumber/cucumber');
const { Builder, Browser, By, Key, until } = require('selenium-webdriver')

Given('I have navigated to the uploader page', async function () {
  let URL = "https://uploader.ingest-dev.aws.onsdigital.uk/council-tax/E00000000-Test&Test.html"

  this.driver = await new Builder().forBrowser(Browser.CHROME).build();
  await this.driver.get(URL);
});


Then('I should see "Council Tax - Test"', async function () {
    let councilNameElement = await this.driver.findElement(By.id('council-name'));
    let actualText = await councilNameElement.getText();
    let pageText = await this.driver.findElement(By.tagName('body')).getText();

    assert.strictEqual(actualText, "Council Tax - Test");
    assert.ok(pageText.includes("Council Tax - Test"));
});
