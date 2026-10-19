"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(
  app,
  /function viewScale\(\)\s*\{[\s\S]*?return Math\.max\(0\.01, Number\(zoom\) \|\| 1\);[\s\S]*?\}/,
  "X-axis geometry and annotations must share the frame zoom"
);
assert(!app.includes("must remain in screen pixels"), "X-axis annotations must not be screen-pixel locked");
assert(/ctx\.translate\(planView\.pan\.x, planView\.pan\.y\);\s*ctx\.scale\(planView\.zoom, planView\.zoom\);/.test(html), "Plan drawings must scale the complete canvas sheet");
assert(!html.includes("baseTransform.scale * planView.zoom"), "Plan model coordinates must not apply a second zoom");
assert(html.includes("x: (canvasPoint.x - planView.pan.x) / zoom"), "Plan label hit testing must invert the paper transform");
assert(/ctx\.translate\(yAxisView\.pan\.x, yAxisView\.pan\.y\);\s*ctx\.scale\(yAxisView\.zoom, yAxisView\.zoom\);/.test(html), "Y-axis drawings must scale the complete canvas sheet");
assert(!html.includes("baseTransform.scale * yAxisView.zoom"), "Y-axis model coordinates must not apply a second zoom");
assert(html.includes("x: (canvasPoint.x - yAxisView.pan.x) / zoom"), "Y-axis label hit testing must invert the paper transform");
assert(html.includes("ctx.scale(isoZoom, isoZoom);"), "3D ISO drawings must scale as one paper-space composition");
assert(!html.includes("baseScale * Math.max(0.35"), "3D ISO projection must not zoom geometry separately from annotations");
assert(!html.includes("raw.u * scale + (Number(isometricView.pan?.x)"), "3D ISO pan must apply to the complete composition");

console.log("unified drawing paper-scale regression tests: passed");
