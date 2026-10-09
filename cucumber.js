// Cucumber configuration (default profile).
// Features and step definitions live under ./features.
//
// Formatters (cucumber-js v11 allows only ONE stdout formatter):
//   - features/support/pretty_formatter.js -> stdout: an in-repo, dependency-free
//     formatter that lists each scenario and its steps (behave-style) plus a
//     summary. Used instead of @cucumber/pretty-formatter, which requires
//     Node 20+ while the behaviour-test CI image runs Node 18.
//   - "html" -> file: cucumber-report.html, a machine-readable report artifact
//     (collect it in the task if you want to keep it).
module.exports = {
  default: {
    timeout: 30000,
    format: [
      "./features/support/pretty_formatter.js",
      '"html":"cucumber-report.html"',
    ],
    formatOptions: {
      snippetInterface: "synchronous",
    },
  },
};
