"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function sourceFunction(name) {
  const start = html.indexOf(`function ${name}`);
  assert(start >= 0, `${name} function is missing`);
  const opening = html.indexOf("{", start);
  let depth = 0;
  for (let index = opening; index < html.length; index += 1) {
    if (html[index] === "{") depth += 1;
    if (html[index] === "}") depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`${name} function is incomplete`);
}

const api = Function(`${sourceFunction("beamStirrupSpacingLimits")}; return {beamStirrupSpacingLimits};`)();

const ordinary = api.beamStirrupSpacingLimits(450, 20, 0, 28, 300, false);
assert.strictEqual(ordinary.fieldMaximum, 225, "Ordinary low-shear beam field spacing must be limited to d/2");
assert.strictEqual(ordinary.supportMaximum, 225, "Ordinary beams must not receive the tighter seismic end-zone cap");

const seismic = api.beamStirrupSpacingLimits(450, 20, 0, 28, 300, true);
assert.strictEqual(seismic.fieldMaximum, 225, "Seismic field spacing must retain the d/2 cap");
assert.strictEqual(seismic.supportMaximum, 112.5, "Seismic end-zone spacing must be governed by d/4");

const highShear = api.beamStirrupSpacingLimits(450, 20, 1000000, 28, 300, false);
assert.strictEqual(highShear.highShear, true, "High shear must trigger the tighter spacing branch");
assert.strictEqual(highShear.fieldMaximum, 112.5, "High-shear spacing must be limited to d/4");

assert(!html.includes("3@50 mm from support"), "The blanket three-stirrups-at-50-mm schedule must be removed");
assert(html.includes("first stirrup &le;${reinforcement.firstStirrupOffset} mm"), "The reviewed first-stirrup location must be displayed");
assert(html.includes('event.stopPropagation();') && !html.includes('scrollHost.scrollBy'), "Drawing wheel input must stay inside the canvas and must not scroll the page");
assert(css.includes("main{overflow-x:hidden!important;overflow-y:auto!important"), "The main drawing workspace must not create horizontal page scrolling");
assert(css.includes(".drawing-control-row.plan-control-row{position:sticky!important"), "Drawing controls must remain sticky above the canvas");
assert(html.includes("pan.x += dx;") && html.includes("pan.y += dy;") && html.includes("queuePanDraw();"), "X-axis left-mouse panning must update the X view directly");
assert(html.includes("function detachAuxiliaryGridEndpoint(endpoint, gridId)") && html.includes("planLevelWalls().map(wall => detachItemFromAuxiliaryGrid(wall, auxiliaryGrid.id))"), "Deleting an auxiliary grid must detach and retain connected walls and their loads");
assert(!html.includes("Auxiliary grid, ${connected.length} connected beam(s), and ${connectedWalls.length} connected wall(s) deleted"), "Grid deletion must not report or perform deletion of connected structural items");

console.log("drawing navigation and economical stirrup-spacing regression tests: passed");
