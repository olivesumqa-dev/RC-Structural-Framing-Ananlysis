"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert(html.includes("data-estimate-category-unit-price"), "Every member estimate table needs editable unit prices");
assert(html.includes("data-estimate-category-cost"), "Every member estimate table needs per-material total costs");
assert(html.includes("data-estimate-category-grand-total"), "Every member estimate table needs a grand total cost");
assert(html.includes("categoryPrices"), "Per-member estimate prices must persist with pricing state");
assert(html.includes("structuralEstimatePricing: deepCopy(structuralEstimatePricingState)"), "Estimate prices must save with the current STF project");
const chbPresetPrices = Array.from(html.matchAll(/prices:\s*\{[^}]*?\bchb4:\s*(\d+(?:\.\d+)?),\s*chb6:\s*(\d+(?:\.\d+)?)/g));
assert(chbPresetPrices.length >= 4 && chbPresetPrices.every(([, chb4, chb6]) => Number(chb4) === 16 && Number(chb6) === 21),
  "Every Philippine SE preset must default 4-inch CHB to ₱16/pc and 6-inch CHB to ₱21/pc");
assert(html.includes("chbPriceDefaultsVersion")
  && html.includes('structuralEstimatePricingState.prices[key] = Number(defaults[key]) || 0;'),
  "Former saved zero-price CHB values must migrate to the supplied editable defaults");
assert(html.includes('id="isoProjectionBtn"'), "3D view needs an isometric/perspective toggle");
assert(html.includes('isometricView.projection === "perspective"'), "Perspective projection must be selectable and rendered");
assert(html.includes('"rgba(150, 166, 163, 0.50)"'), "3D beam solids need 50% opacity");
assert(html.includes('"rgba(28, 138, 86, 0.50)", "#72f2ad"'), "3D columns need 50% green faces and light-green outlines");
assert(html.includes('id="isoCameraHeightInput"') && html.includes('Number(isometricView.cameraHeight) || 4.5') && html.includes('const depth = rotatedX + rotatedY;') && html.includes('const screenHeight = relativeHeight * Math.cos(tiltRadians) - depth * Math.sin(tiltRadians);'), "Perspective camera height must be user-adjustable and use the shared 3D depth axis");
assert(html.includes('min="-60" max="60"') && html.includes("Math.max(-60, Math.min(60"), "Camera tilt must support both negative and positive values");
assert(html.includes("cameraHeight: isometricView.cameraHeight"), "Perspective camera height must save with the current STF project");
assert(html.includes('id="isoShowSlabs"') && html.includes('id="isoShowFootings"') && html.includes('id="isoShowColumns"') && html.includes('id="isoShowBeams"'), "3D view needs independent visibility checkboxes");
assert(html.includes('id="isoShowFrames"') && html.includes("if (isometricView.visibility.frames)"), "3D view needs a functional X and Y axis frames visibility checkbox");
assert(html.includes("visibility: deepCopy(isometricView.visibility)"), "3D visibility choices must save with the current STF project");
assert(["footings", "columns", "beams", "slabs"].every(key => new RegExp(`if \\(.*isometricView\\.visibility\\.${key}`).test(html)), "Each visibility checkbox must control its corresponding 3D objects");
assert(html.includes('"rgba(163, 120, 113, 0.50)"'), "3D slabs need the requested #A37871 color at 50% opacity");
assert.match(html, /slabDesignOverrides\[cell\.key\][\s\S]*?override\.thickness[\s\S]*?drawIsoSolid/, "3D slabs must use their actual MPR thickness");

console.log("member estimate pricing and perspective 3D regression checks: passed");
