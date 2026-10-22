const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert.match(source, /class="member-props-actions structural-plan-actions"[\s\S]*?id="planPrintBtn"[\s\S]*?id="planPrintPdfBtn"/,
  "Structural Plan print controls must use the MPR-aligned title-strip action styling");
assert.match(source, /function printAllDrawingViews\([\s\S]*?for \(let levelIndex = -1; levelIndex < data\.levels\.length; levelIndex \+= 1\)/,
  "all Foundation and Level plan canvases must be captured");
assert.match(source, /capture\("X-Axis Frame", xCanvas\);[\s\S]*?capture\("Y-Axis Frame", yCanvas\);[\s\S]*?capture\("3D Isometric View", isoCanvas\);/,
  "X frame, Y frame, and 3D ISO must be included");
assert.match(source, /\.drawing-page\{[^}]*break-after:page;page-break-after:always/,
  "each drawing view must print on a separate page");
assert.match(source, /planState\.activeLevelIndex = originalLevelIndex;[\s\S]*?planState\.activeView = originalView;/,
  "printing must restore the user's original drawing view");
assert.match(source, /byId\("planPrintBtn"\)\?\.addEventListener\("click", \(\) => printAllDrawingViews\("printer"\)\)/,
  "local print must use the all-view print workflow");
assert.match(source, /byId\("planPrintPdfBtn"\)\?\.addEventListener\("click", \(\) => printAllDrawingViews\("pdf"\)\)/,
  "PDF print must use the all-view print workflow");

console.log("All drawing view print regression checks passed.");
