// Cucumber configuration (default profile).
// Features and step definitions live under ./features.
//
// Formatters (cucumber-js v11 allows only ONE stdout formatter):
//   - "progress-bar"  -> stdout: readable live progress + end-of-run summary
//                        with totals and any failures (clearer than the default
//                        "progress" dots).
//   - "html"          -> file: cucumber-report.html, a machine-readable report
//                        artifact (collect it in the task if you want to keep it).
module.exports = {
  default: {
    timeout: 30000,
    // Single stdout formatter (cucumber-js v11 allows only one). "progress-bar"
    // gives readable live progress and an end-of-run summary that lists totals
    // and any failures with their location -- much clearer than the default
    // "progress" dots. A machine-readable report is also written to a file.
    format: ["progress-bar", '"html":"cucumber-report.html"'],
    formatOptions: {
      snippetInterface: "synchronous",
    },
  },
};
