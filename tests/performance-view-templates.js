"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert(html.includes("function requestCoordinatedAnalysis()") && html.includes("coordinatedAnalysisRunning || coordinatedAnalysisQueued"), "Calculation requests must be coalesced");
assert(html.includes('button.onclick = event =>') && html.includes("requestCoordinatedAnalysis();"), "All Calculate buttons must use one coordinated handler");
assert(html.includes("function scheduleCoordinatedResults()") && html.includes("requestIdleCallback"), "MPR rebuilds must be deferred outside drawing-tool input events");
assert(html.includes("const baseTransform = fitDrawingTransform") && !html.includes("ctx.scale(planView.zoom, planView.zoom)"), "Native plan zoom must preserve fixed screen-space symbols, text, and lineweights");
assert(!html.includes("ctx.scale(yAxisView.zoom, yAxisView.zoom)"), "Y-frame zoom must preserve fixed screen-space symbols and lineweights");
assert(html.includes('id="isoTiltInput"') && html.includes("isometricView.tilt") && html.includes("Math.sin(tiltRadians)"), "3D ISO needs a visible, editable and persistent tilt angle");
assert(html.includes('sourceAsset: "assets/templates/9-STO. BLDG.stf"') && html.includes('sourceAsset: "assets/templates/3-STO.COMM.BLDG.stf"'), "Both supplied STF projects must be available as built-in templates");
assert(fs.existsSync(path.join(root, "assets", "templates", "9-STO. BLDG.stf")) && fs.existsSync(path.join(root, "assets", "templates", "3-STO.COMM.BLDG.stf")), "Built-in STF template assets must exist");
assert(css.includes("td.design-status.slab-on-fill-status{color:#43f58a!important}"), "Slab-on-fill MPR status must remain green in both themes");

console.log("Performance, fixed-size drawing, ISO tilt, and STF template regression tests: passed");
