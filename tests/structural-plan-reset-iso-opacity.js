"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert.match(
  html,
  /function resetStructuralPlanGridInputs\(\)[\s\S]{0,420}\["X", "A,B"\][\s\S]{0,120}\["Y", "1,2"\][\s\S]{0,260}spansInput\.value = "0"/,
  "New-design grid reset must retain only A/B and 1/2 with a zero span"
);
assert.match(
  html,
  /const clearedGridDraft = planState\.isBlankNewDesign[\s\S]{0,1600}check\.checked = !clearedGridDraft/,
  "The two retained reset-grid labels must render unchecked"
);
assert.match(
  html,
  /planState\.isBlankNewDesign = true;\s*resetStructuralPlanGridInputs\(\);\s*renderStructuralPlanEditors\(\);/,
  "Create New Design must reset and immediately redraw the Structural Plan grid controls"
);
assert.match(
  html,
  /const plane = \(corners, color\) => \{[\s\S]{0,260}ctx\.globalAlpha = 0\.23;/,
  "X/Y ISO section planes must use the requested 23% fill opacity"
);

console.log("structural plan reset and ISO opacity regression tests: passed");
