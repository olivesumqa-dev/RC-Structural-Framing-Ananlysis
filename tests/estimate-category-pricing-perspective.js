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
assert(html.includes('id="isoProjectionBtn"'), "3D view needs an isometric/perspective toggle");
assert(html.includes('isometricView.projection === "perspective"'), "Perspective projection must be selectable and rendered");
assert(html.includes('"rgba(150, 166, 163, 0.42)"'), "3D beam solids need reduced opacity");
assert(html.includes('"rgba(28, 138, 86, 0.72)", "#72f2ad"'), "3D columns need green faces and light-green outlines");
assert(html.includes('id="isoCameraHeightInput"') && html.includes('Number(isometricView.cameraHeight) || 4.5') && html.includes('relativeDepth * Math.cos(tiltRadians) + relativeHeight * Math.sin(tiltRadians)'), "Perspective camera height must be user-adjustable and make height recede toward the horizon");
assert(html.includes("cameraHeight: isometricView.cameraHeight"), "Perspective camera height must save with the current STF project");
assert(html.includes('id="isoShowSlabs"') && html.includes('id="isoShowFootings"') && html.includes('id="isoShowColumns"') && html.includes('id="isoShowBeams"'), "3D view needs independent visibility checkboxes");
assert(html.includes("visibility: deepCopy(isometricView.visibility)"), "3D visibility choices must save with the current STF project");
assert(["footings", "columns", "beams", "slabs"].every(key => new RegExp(`if \\(.*isometricView\\.visibility\\.${key}`).test(html)), "Each visibility checkbox must control its corresponding 3D objects");
assert(html.includes('"rgba(163, 120, 113, 0.25)"'), "3D slabs need the requested #A37871 color at 25% opacity");
assert.match(html, /slabDesignOverrides\[cell\.key\][\s\S]*?override\.thickness[\s\S]*?drawIsoSolid/, "3D slabs must use their actual MPR thickness");

console.log("member estimate pricing and perspective 3D regression checks: passed");
