"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function sourceFunction(name) {
  const match = html.match(new RegExp(`function ${name}[^\\{]*\\{[\\s\\S]*?\\n      \\}`));
  assert(match, `${name} function is missing`);
  return match[0];
}

const candidateReason = Function(
  `${html.match(/const COLUMN_MIN_STEEL_RATIO = [^;]+;/)[0]}
   ${html.match(/const COLUMN_MAX_STEEL_RATIO = [^;]+;/)[0]}
   ${sourceFunction("columnCandidateReason")}
   return columnCandidateReason;`
)();

const passingDemand = {
  axialPass: true,
  slenderX: {stable: true},
  slenderY: {stable: true},
  interactionRatio: 0.72
};
const common = {
  demandCaseCount: 1,
  failure: passingDemand,
  barsFit: true,
  tieSpacing: 100,
  pass: false
};

const sixD16Ratio = 6 * Math.PI * 16 * 16 / 4 / (400 * 400);
assert.strictEqual(
  candidateReason({...common, steelRatio: sixD16Ratio}),
  "MIN. STEEL 0.75% < 1.00%",
  "A 400x400 column with 6-D16 must identify the minimum-steel failure"
);
assert.strictEqual(
  candidateReason({...common, steelRatio: 0.065}),
  "MAX. STEEL 6.50% > 6.00%",
  "Excessive longitudinal steel must identify the maximum-steel failure"
);
assert.strictEqual(
  candidateReason({...common, steelRatio: 0.02, tieSpacing: 0}),
  "TIE SPACING NOT CONSTRUCTIBLE",
  "An invalid tie arrangement must have a specific status"
);
assert.strictEqual(
  candidateReason({...common, steelRatio: 0.02, pass: true}),
  "PASS",
  "A fully compliant candidate must pass"
);
assert(!html.includes('"DETAILING"'), "The ambiguous DETAILING status remains in the column design code");
assert(html.includes("required 1.00%-6.00%"), "The MPR tooltip does not explain the longitudinal steel limits");
assert(html.includes("columnCandidateReason({demandCaseCount: demandCases.length"), "The active column evaluator does not use the precise status helper");
assert(html.includes("#columnResultsTable td:nth-child(18)"), "The column status width is not protected from broken diagnostic text");

console.log("column detailing status regression tests: passed");
