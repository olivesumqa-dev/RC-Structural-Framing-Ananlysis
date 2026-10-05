"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert(html.includes("const isoFootings = Object.entries(planState.footings || {})"), "3D ISO footing collection is missing");
assert(html.includes("Number(footing.width) || Number(footing.designWidth)"), "3D ISO footing width is not based on design dimensions");
assert(html.includes("Number(footing.length) || Number(footing.designLength)"), "3D ISO footing length is not based on design dimensions");
assert(html.includes("Number(footing.thickness) || Number(footing.designThickness)"), "3D ISO footing thickness is not based on design dimensions");
assert(html.includes("const drawIsoFooting = footing =>"), "3D ISO footing solid renderer is missing");
assert(html.includes("const z0 = -footing.thickness"), "3D ISO footing is not drawn below foundation level");
assert(html.includes(".forEach(drawIsoFooting)"), "3D ISO footing solids are not rendered");
assert(html.includes('id="isoFramesOnlyBtn"'), "3D ISO needs an X/Y-frames-only toggle");
assert(html.includes("isometricView.frameOnly = !isometricView.frameOnly"), "The X/Y-frames-only control must toggle back to the regular view");
assert(html.includes('canvas.dataset.isoFrameOnly = frameOnly ? "true" : "false"'), "The active 3D ISO frame-only state must be exposed for verification");
assert(html.includes("const xGridSideY = totalY"), "Alphabetic 3D grids must stay on the fixed plan-view top side");
assert(html.includes("const yGridSideX = 0"), "Numeric 3D grids must stay on the fixed plan-view left side");
assert(html.includes("{x, y: xGridSideY, z: totalZ}"), "Alphabetic grid bubbles are not fixed to their outer side");
assert(html.includes("{x: yGridSideX, y, z: totalZ}"), "Numeric grid bubbles are not fixed to their outer side");
assert(html.includes("ctx.moveTo(base.x, base.y - columnGap)"), "3D grid leaders must begin above the columns with a gap");
assert(html.includes("ctx.lineTo(base.x, bubble.y + bubbleRadius)"), "3D grid leaders must remain screen-vertical");
assert(html.includes("stack * 28"), "Overlapping 3D grid bubbles are not vertically stacked");
assert(html.includes("sharedCornerAlphabeticBubble"), "The shared A/1 corner grid stacking rule is missing");
assert(html.includes("suppressLeader: true"), "Grid 1 must omit its leader when stacked directly above Grid A");
assert(html.includes("sharedCornerAlphabeticBubble.y - 2 * sharedCornerAlphabeticBubble.radius - 2"), "Grid 1 must sit directly above the Grid A circle");
assert(!html.includes('ctx.fillStyle = "rgba(5, 21, 23, 0.82)"'), "3D ISO member labels must not use opaque background rectangles");

console.log("isometric footing and top-grid regression tests: passed");
