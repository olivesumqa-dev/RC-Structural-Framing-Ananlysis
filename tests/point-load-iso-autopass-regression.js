"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert(html.includes("function nearestPlanPointLoad"), "Plan point loads need an eraser hit-test");
assert.match(html, /planState\.mode === "delete"[\s\S]*?nearestPlanPointLoad\(canvasPoint, data\)[\s\S]*?planState\.pointLoads = \(planState\.pointLoads \|\| \[\]\)\.filter/, "The Plan eraser must remove a clicked point load");
assert(html.includes("function removeCoordinatedPlanPointLoad"), "Frame erasing needs a coordinated Plan/X/Y point-load remover");
assert.match(html, /function deleteYLoadAt[\s\S]*?removeCoordinatedPlanPointLoad\(hit\.sourceId\)/, "The Y-frame eraser must remove coordinated point loads");
assert.match(html, /function deleteXLoadAt[\s\S]*?removeCoordinatedPlanPointLoad\(hit\.sourceId\)/, "The X-frame eraser must remove coordinated point loads");
assert(html.includes("const drawIsoSolid = (bounds, fill, stroke) =>"), "3D ISO needs a solid member renderer");
assert(html.includes('isoBeamDimensions("X"') && html.includes('isoBeamDimensions("Y"'), "3D ISO beams must use MPR dimensions on both axes");
assert(html.includes("engineeringState.columnDesignOverrides[columnOverrideKey(key, storyIndex)]"), "3D ISO columns must use story-specific MPR dimensions");
assert(html.includes('const fallback = {beams: false, columns: false, slabs: false, footings: false}'), "AUTO-PASS must be opt-in by default");
assert(html.includes("return mprAutoPassState[tableKey] === true"), "AUTO-PASS must run only after deliberate selection");
assert(html.includes("iteration < 50"), "AUTO-PASS needs the extended convergence search");
assert(html.includes("ctx.font = `700 ${scaledDrawingTextSize(fontSize)}px"), "3D member labels must be bold");
assert(app.includes('ctx.font = ctx.font.replace(/^300\\s/, "700 ")'), "X-frame member labels must be bold");

console.log("point-load eraser, 3D solid members, and opt-in AUTO-PASS checks: passed");
