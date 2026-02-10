// test/jest.setup.js
const fs = require('fs');
const path = require('path');

// Load the HTML fixture
const html = fs.readFileSync(
  path.resolve(__dirname, './scripts/fileSubmissionForm.fixture.html'),
  'utf8'
);

document.body.innerHTML = html;

// Load your validation script
// Adjust this path to wherever your actual file_submission.js is located
require('../scripts/file_submission.js');
