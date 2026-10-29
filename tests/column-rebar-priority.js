const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");

assert.match(
  html,
  /"columnLongitudinalBarDiameter"\s*:\s*\{\s*"value"\s*:\s*"16"\s*\}/,
  "The shipped opening project must default column longitudinal bars to 16 mm."
);

const matcher = /function bestColumnCandidateForSection\(key, storyIndex, width, height\) \{([\s\S]*?)\n      \}/;
const match = html.match(matcher);
assert(match, "Column AUTO-PASS candidate selector is missing.");
const body = match[1];

assert.match(
  body,
  /for \(const barDiameter of MPR_COLUMN_BEAM_BAR_DIAMETERS\)/,
  "AUTO-PASS must use the standard 16, 20, 25, 30 mm sequence."
);
assert(!body.includes("defaultBarDiameter"), "A Member Properties value must not reorder the AUTO-PASS bar sequence.");
assert.match(
  body,
  /const maximumCount = columnMaximumConstructibleBarCount[\s\S]*?for \(; count <= maximumCount; count \+= 2\)[\s\S]*?if \(passingForCount\) \{\s*return passingForCount;/,
  "AUTO-PASS must add 16 mm bars through the permitted count range before increasing diameter."
);
assert(!body.includes("count <= 24"), "AUTO-PASS must not impose an arbitrary 24-bar limit before trying the next diameter.");
assert(!body.includes("passingForCount.cost < best.cost"), "AUTO-PASS must not replace a passing smaller-diameter solution with a larger bar based on cost.");
assert(html.includes("function migrateLegacyColumnRebarPriority()"), "Opening older projects must migrate non-manual column AUTO-PASS results to the 16 mm count-first policy.");
assert(html.includes("rebarPriorityPolicy: COLUMN_REBAR_PRIORITY_POLICY"), "New AUTO-PASS column results must record the rebar-priority policy.");

console.log("Column longitudinal rebar priority regression checks passed.");
