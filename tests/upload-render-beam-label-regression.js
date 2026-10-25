"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function extractedFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} must exist`);
  const bodyStart = html.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < html.length; index += 1) {
    if (html[index] === "{") depth += 1;
    else if (html[index] === "}") {
      depth -= 1;
      if (depth === 0) return html.slice(start, index + 1);
    }
  }
  throw new Error(`${name} could not be extracted`);
}

assert.strictEqual((html.match(/font: "700 10\.8px Arial",\s*color: "#fff200"/g) || []).length, 3,
  "Every Plan beam-label path must be bright yellow and exactly 20% larger");
assert(html.includes('font: member.type === "Column" ? "700 10px Arial" : "700 12px Arial"')
  && html.includes('color: member.type === "Column" ? "#00e676" : "#fff200"'),
  "Y-frame beams must be bright yellow and 20% larger while columns remain green");
assert(app.includes('setScaledFont((m.type === "Beam" || m.type === "Tie Beam") ? 12 : 10);')
  && app.includes('drawRotatedText(label, p.x, p.y, 0, "#fff200")'),
  "X-frame beams must be bright yellow and 20% larger");

assert(html.includes('panelCanvas.toDataURL("image/png")'),
  "Split raster panels must preserve thin lines with lossless PNG encoding");
assert(!html.includes('panelCanvas.toDataURL("image/jpeg"'),
  "Split raster panels must not be recompressed as JPEG");
assert(!html.includes("function rasterPixelIsInk("),
  "The withdrawn adaptive contrast detector must not create false members or grids");
assert(!html.includes("function rasterStrokeProfile("),
  "The withdrawn adaptive stroke profiler must not create false members or grids");
assert((html.match(/const maxSide = 1200;/g) || []).length >= 3,
  "Raster analysis must use the established conservative scale");
assert(html.includes("coverage >= 0.72"),
  "Off-grid members must continue to require strong native-line evidence");

assert(html.includes('accept=".dxf,.dwf,application/x-dwf,model/vnd.dwf,image/png,image/jpeg,.png,.jpg,.jpeg" multiple'),
  "Upload Drawings must accept Autodesk DWF files");
assert(html.includes("<label>AutoCAD DXF, DWF, or plan images</label>"),
  "The Upload Drawings label must advertise DWF alongside DXF and plan images");
assert(html.includes("async function validateAutodeskDwfFile(file)")
  && html.includes("cannot yet decode its W2D vector stream"),
  "DWF intake must validate the file and disclose the required conversion service");
assert(/byId\("newDesign"\)\?\.addEventListener\("click", \(\) => \{\s*resetCadUploadState\(\);/.test(html),
  "Confirmed Create New Design must clear uploaded files and their sidebar entries");

console.log("Conservative raster upload, DWF intake, new-design cleanup, and beam-label regression checks passed.");
