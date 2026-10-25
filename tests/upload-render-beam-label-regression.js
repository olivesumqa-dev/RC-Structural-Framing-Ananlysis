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
assert(html.includes("function rasterPixelIsInk(luminance, background, minimumContrast = 30)")
  && html.includes("Math.abs(luminance - background) >= minimumContrast"),
  "Raster line detection must use background-relative contrast");
assert(html.includes("const sampleCount = 11;")
  && html.includes("return medianNumber(dominant);"),
  "Raster background detection must use the dominant sheet tone rather than vulnerable corner averaging");
assert((html.match(/Math\.round\(x\)/g) || []).length >= 3
  && (html.match(/Math\.round\(y\)/g) || []).length >= 3,
  "Every raster sampler must round interpolated stroke coordinates to valid pixel offsets");
assert(html.includes("function rasterStrokeProfile(sample, background")
  && html.includes("longestRunLength")
  && html.includes("present: continuousSolid && !hidden"),
  "Raster line detection must preserve interrupted solid strokes while distinguishing repeated dashes");
assert(html.includes('context.imageSmoothingQuality = "high"')
  && (html.match(/const maxSide = 1600;/g) || []).length >= 3,
  "Raster analysis must use high-quality scaling at a line-preserving resolution");
assert(html.includes("coverage >= 0.52"),
  "Off-grid members must use the repaired band-sampling threshold");

const rasterAlgorithms = Function(
  `"use strict";${extractedFunction("medianNumber")}${extractedFunction("rasterCornerBackground")}${extractedFunction("rasterPixelIsInk")}${extractedFunction("rasterStrokeProfile")};return {rasterCornerBackground,rasterStrokeProfile};`
)();
const mostlyLightBackground = rasterAlgorithms.rasterCornerBackground(
  (x, y) => (x < 60 && y < 60 ? 5 : 246),
  1000,
  800
);
assert.strictEqual(mostlyLightBackground, 246,
  "One dark border/title corner must not make blank white paper look like structural ink");
const interruptedSolid = rasterAlgorithms.rasterStrokeProfile(
  (x) => ([30, 31, 68, 69].includes(Math.round(x)) ? 255 : 0),
  255,
  0,
  0,
  100,
  0
);
assert(interruptedSolid.present && !interruptedSolid.hidden,
  "One- and two-pixel raster/compression gaps must not erase a solid member");
const dashedHidden = rasterAlgorithms.rasterStrokeProfile(
  (x) => (Math.round(x) % 12 < 5 ? 0 : 255),
  255,
  0,
  0,
  100,
  0
);
assert(dashedHidden.hidden && !dashedHidden.present,
  "Repeated short dashes must remain hidden-line geometry rather than becoming a beam");

assert(html.includes('accept=".dxf,.dwf,application/x-dwf,model/vnd.dwf,image/png,image/jpeg,.png,.jpg,.jpeg" multiple'),
  "Upload Drawings must accept Autodesk DWF files");
assert(html.includes("<label>AutoCAD DXF, DWF, or plan images</label>"),
  "The Upload Drawings label must advertise DWF alongside DXF and plan images");
assert(html.includes("async function validateAutodeskDwfFile(file)")
  && html.includes("cannot yet decode its W2D vector stream"),
  "DWF intake must validate the file and disclose the required conversion service");
assert(/byId\("newDesign"\)\?\.addEventListener\("click", \(\) => \{\s*resetCadUploadState\(\);/.test(html),
  "Confirmed Create New Design must clear uploaded files and their sidebar entries");

console.log("Upload reliability, DWF intake, new-design cleanup, and beam-label regression checks passed.");
