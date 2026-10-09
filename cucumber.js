// Cucumber configuration (default profile).
// Features and step definitions live under ./features.
//
// Formatters (cucumber-js v11 allows only ONE stdout formatter):
//   - "@cucumber/pretty-formatter" -> stdout: lists every scenario and each of
//     its steps with location, like Python behave's pretty output. This renders
//     fully in a non-TTY CI log (unlike "progress-bar", whose live bar collapses
//     to just the totals).
//   - "html" -> file: cucumber-report.html, a machine-readable report artifact
//     (collect it in the task if you want to keep it).
module.exports = {
  default: {
    timeout: 30000,
    format: ["@cucumber/pretty-formatter", '"html":"cucumber-report.html"'],
    formatOptions: {
      snippetInterface: "synchronous",
    },
  },
};
