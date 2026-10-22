const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert.match(source, /class="member-props-actions structural-plan-actions"[\s\S]*?id="planPrintBtn"[\s\S]*?id="planPrintPdfBtn"/,
  "Structural Plan print controls must use the MPR-aligned title-strip action styling");
assert.match(source, /function printAllDrawingViews\([\s\S]*?for \(let levelIndex = -1; levelIndex < data\.levels\.length; levelIndex \+= 1\)/,
  "all Foundation and Level plan canvases must be captured");
assert.match(source, /capture\("X-Axis Frame", xCanvas\);[\s\S]*?capture\("Y-Axis Frame", yCanvas\);[\s\S]*?capture\("3D Isometric View", isoCanvas, true\);/,
  "X frame, Y frame, and 3D ISO must be included");
assert.match(source, /\.drawing-page\{[^}]*break-after:page;page-break-after:always/,
  "each drawing view must print on a separate page");
assert.match(source, /@page\{size:297mm 210mm;/,
  "Structural Plan and MPR print output must explicitly use physical A4 landscape dimensions");
assert.match(source, /function monochromeDrawingDataUrl\([\s\S]*?const paper = alpha < 16 \|\| distance < 24;[\s\S]*?croppedContext\.drawImage\(output,[\s\S]*?return cropped\.toDataURL\("image\/png"\);/,
  "drawing canvases must be converted to a cropped white-background, black-object print image");
assert.match(source, /@page\{size:297mm 210mm;margin:5mm\}/,
  "combined view output must maximize the A4 landscape printable area");
assert.match(source, /const trimInk = Math\.max\(1, Math\.floor\(totalInk \* 0\.0015\)\);[\s\S]*?lowerExtent\(columnInk\)[\s\S]*?upperExtent\(rowInk\)/,
  "drawing extents must ignore isolated edge pixels that make the printed drawing too small");
assert.match(source, /id="isoShowFrames" type="checkbox">X&amp;Y Axis Frames/,
  "3D ISO X and Y frame overlays must be off by default");
assert.match(source, /visibility: \{slabs: true, footings: true, columns: true, beams: true, frames: false\}/,
  "3D ISO state must default X and Y frame overlays to hidden");
assert.match(source, /ctx\.lineWidth = isometricPrintRender \? 2\.25 : 1;/,
  "3D member edges must use a print-specific plotted line thickness");
assert.match(source, /ctx\.fillStyle = isometricPrintRender \? "rgba\(128, 128, 128, 0\.50\)" : fill;[\s\S]*?ctx\.strokeStyle = isometricPrintRender \? "#000000" : stroke;/,
  "3D printed members must retain a 50% tonal fill with black plotted edges");
assert.match(source, /isometricPrintRender = true;[\s\S]*?capture\("3D Isometric View", isoCanvas, true\);[\s\S]*?isometricPrintRender = false;/,
  "3D print rendering must enable and then restore the print edge treatment");
assert.match(source, /const capture = \(title, canvasElement, preserveTones = false\) => pages\.push\(\{title, image: monochromeDrawingDataUrl\(canvasElement, preserveTones\)\}\);/,
  "combined drawing pages must use monochrome captures with optional 3D tones");
assert.match(source, /planState\.activeLevelIndex = originalLevelIndex;[\s\S]*?planState\.activeView = originalView;/,
  "printing must restore the user's original drawing view");
assert.match(source, /byId\("planPrintBtn"\)\?\.addEventListener\("click", \(\) => printAllDrawingViews\("printer"\)\)/,
  "local print must use the all-view print workflow");
assert.match(source, /byId\("planPrintPdfBtn"\)\?\.addEventListener\("click", \(\) => printAllDrawingViews\("pdf"\)\)/,
  "PDF print must use the all-view print workflow");

console.log("All drawing view print regression checks passed.");
