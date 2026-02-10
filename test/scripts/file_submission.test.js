const { describe, test, expect } = require('@jest/globals');

describe("File submission validation", () => {

  function submitForm() {
    const form = document.getElementById("form");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }

  function getErrors() {
    return document.querySelectorAll("#errors-list-item li");
  }

  test("when both files missing, individual error messages should be displayed for each file", () => {
    // arrange
    const form = document.getElementById("form");

    Object.defineProperty(form, "fileOne", {
      value: { files: [] },
      configurable: true
    });

    Object.defineProperty(form, "fileTwo", {
      value: { files: [] },
      configurable: true
    });

    // act
    submitForm();

    // assert
    const errors = getErrors();
    expect(errors.length).toBe(2);
    expect(errors[0].textContent).toMatch(/you need to add an extract file/i);
    expect(errors[1].textContent).toMatch(/you need to add a mani file/i);
  });

  test("when only EXTRACT file is missing a single specific error message should be displayed", () => {
    // arrange
    const form = document.getElementById("form");

    Object.defineProperty(form, "fileOne", {
      value: { files: [] },
      configurable: true
    });

    Object.defineProperty(form, "fileTwo", {
      value: {
        files: [
          { name: "CTAX_MANI_ABC_20240101.csv", type: "text/csv", size: 100 }
        ]
      },
      configurable: true
    });

    // act
    submitForm();

    // assert
    const errors = getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].textContent).toMatch(/extract/i);
  });

  test("when only a MANI file is missing a single specific error message should be displayed", () => {
    // arrange
    const form = document.getElementById("form");

    Object.defineProperty(form, "fileOne", {
      value: {
        files: [
          { name: "CTAX_EXTRACT_ABC_20240101.csv", type: "text/csv", size: 100 }
        ]
      },
      configurable: true
    });

    Object.defineProperty(form, "fileTwo", {
      value: { files: [] },
      configurable: true
    });

    // act
    submitForm();

    // assert
    const errors = getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].textContent).toMatch(/mani/i);
  });
});
