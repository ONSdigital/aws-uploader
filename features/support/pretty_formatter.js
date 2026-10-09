"use strict";

// Minimal in-repo "pretty" formatter for cucumber-js v11.
//
// Why this exists: the official @cucumber/pretty-formatter requires Node 20+
// (it imports styleText from node:util), but the behaviour-test CI image runs
// Node 18. This formatter has zero extra dependencies and runs on Node 18,
// printing a behave-style breakdown: each scenario followed by its steps with
// status, step location and timing, then an end-of-run summary.
//
// It uses only the public formatter API: the base Formatter class, the
// eventBroadcaster "envelope" stream, eventDataCollector, formatterHelpers and
// colorFns -- the same surface the built-in formatters use.

const {
  Formatter,
  formatterHelpers,
  Status,
} = require("@cucumber/cucumber");

const STATUS_MARK = {
  [Status.PASSED]: "\u2714", // ✔
  [Status.FAILED]: "\u2716", // ✖
  [Status.SKIPPED]: "-",
  [Status.PENDING]: "?",
  [Status.UNDEFINED]: "?",
  [Status.AMBIGUOUS]: "?",
  [Status.UNKNOWN]: "?",
};

function formatDuration(duration) {
  if (!duration) return "";
  // messages Duration is { seconds, nanos }.
  const seconds = (duration.seconds || 0) + (duration.nanos || 0) / 1e9;
  if (seconds === 0) return "";
  return ` ${seconds.toFixed(3)}s`;
}

class PrettyFormatter extends Formatter {
  static documentation =
    "Behave-style per-scenario/per-step output (Node 18 compatible).";

  constructor(options) {
    super(options);

    this.counts = {
      scenarios: { total: 0, passed: 0, failed: 0, other: 0 },
      steps: { total: 0, passed: 0, failed: 0, skipped: 0, other: 0 },
    };

    options.eventBroadcaster.on("envelope", (envelope) => {
      if (envelope.testCaseFinished) {
        this.onTestCaseFinished(envelope.testCaseFinished);
      } else if (envelope.testRunFinished) {
        this.onTestRunFinished();
      }
    });
  }

  colorFor(status) {
    // colorFns.forStatus returns a function that wraps text in the right colour
    // (and is a no-op when colour is disabled, e.g. a non-TTY CI log).
    return this.colorFns.forStatus(status);
  }

  onTestCaseFinished(testCaseFinished) {
    const attempt = this.eventDataCollector.getTestCaseAttempt(
      testCaseFinished.testCaseStartedId,
    );
    // A retried attempt that will be retried again is not the final result.
    if (testCaseFinished.willBeRetried) return;

    const parsed = formatterHelpers.parseTestCaseAttempt({
      snippetBuilder: this.snippetBuilder,
      supportCodeLibrary: this.supportCodeLibrary,
      testCaseAttempt: attempt,
    });

    const { testCase, testSteps } = parsed;
    const location = formatterHelpers.formatLocation(testCase.sourceLocation);

    // Scenario header.
    this.log(`\nScenario: ${testCase.name} # ${location}\n`);

    // Tally the scenario by its worst step result.
    const worst = testCase.worstTestStepResult.status;
    this.counts.scenarios.total += 1;
    if (worst === Status.PASSED) this.counts.scenarios.passed += 1;
    else if (worst === Status.FAILED) this.counts.scenarios.failed += 1;
    else this.counts.scenarios.other += 1;

    for (const step of testSteps) {
      // Skip hook steps (Before/After) that have no Gherkin text, so the output
      // mirrors the feature file's step list.
      if (!step.text) continue;

      const status = step.result.status;
      const mark = STATUS_MARK[status] || "?";
      const keyword = (step.keyword || "").trim();
      const loc = step.actionLocation
        ? ` # ${formatterHelpers.formatLocation(step.actionLocation)}`
        : "";
      const duration = formatDuration(step.result.duration);
      const line = `  ${mark} ${keyword} ${step.text}${loc}${duration}`;
      this.log(`${this.colorFor(status)(line)}\n`);

      // Surface the failure message inline, indented, like behave.
      if (status === Status.FAILED && step.result.message) {
        const indented = step.result.message
          .split("\n")
          .map((l) => `      ${l}`)
          .join("\n");
        this.log(`${this.colorFor(status)(indented)}\n`);
      }

      // Step tally.
      this.counts.steps.total += 1;
      if (status === Status.PASSED) this.counts.steps.passed += 1;
      else if (status === Status.FAILED) this.counts.steps.failed += 1;
      else if (status === Status.SKIPPED) this.counts.steps.skipped += 1;
      else this.counts.steps.other += 1;
    }
  }

  onTestRunFinished() {
    const s = this.counts.scenarios;
    const st = this.counts.steps;

    const scenarioParts = [`${s.passed} passed`];
    if (s.failed) scenarioParts.push(`${s.failed} failed`);
    if (s.other) scenarioParts.push(`${s.other} other`);

    const stepParts = [`${st.passed} passed`];
    if (st.failed) stepParts.push(`${st.failed} failed`);
    if (st.skipped) stepParts.push(`${st.skipped} skipped`);
    if (st.other) stepParts.push(`${st.other} other`);

    this.log(
      `\n${s.total} scenarios (${scenarioParts.join(", ")})\n` +
        `${st.total} steps (${stepParts.join(", ")})\n`,
    );
  }
}

module.exports = PrettyFormatter;
module.exports.default = PrettyFormatter;
