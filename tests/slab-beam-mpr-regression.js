"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const cycleMatch = html.match(/function nextSlabRegionUsage\(currentState\) \{[\s\S]*?\n      \}/);
assert(cycleMatch, "Three-state slab usage cycle function is missing");
const nextSlabRegionUsage = Function(`return (${cycleMatch[0]})`)();

assert.strictEqual(nextSlabRegionUsage("CONCRETE"), "OPEN");
assert.strictEqual(nextSlabRegionUsage("OPEN"), "EARTH_FILLED");
assert.strictEqual(nextSlabRegionUsage("EARTH_FILLED"), "CONCRETE");

assert(html.includes("earthFilledSlabs: Array.from(planState.earthFilledSlabs)"), "Earth Filled panels are not saved");
assert(html.includes("planState.earthFilledSlabs = new Set(snapshot.earthFilledSlabs || [])"), "Earth Filled panels are not restored");
assert(html.includes('override.type = "SLAB_ON_FILL"'), "Earth Filled panels are not linked to slab-on-fill design");
assert(html.includes('if (region.earthFilled) return "EARTH FILLED"'), "Earth Filled plan label is missing");
assert(
  html.includes('const thickness = isSlabOnFill ? 100 : requestedThickness;'),
  "Slab-on-fill design is not fixed at the economical 100 mm maximum"
);
assert(
  html.includes('design.slabType === "SLAB_ON_FILL" ? \' max="100"'),
  "The MPR slab-on-fill thickness input does not expose its 100 mm maximum"
);
assert(
  html.includes('input.closest("tr")?.querySelector("[data-slab-type]")?.value === "SLAB_ON_FILL" && value > 100'),
  "Manual MPR edits can bypass the slab-on-fill thickness cap"
);
assert(html.includes("const reinforcementCost = candidate => candidate.selections"), "Economical slab reinforcement comparison is missing");

const clickHandlerMatch = html.match(/function handlePlanCanvasClick\(canvasPoint\) \{[\s\S]*?\n      \}/);
assert(clickHandlerMatch, "Structural Plan click handler is missing");
const slabHitIndex = clickHandlerMatch[0].indexOf("const slab = slabLabelAt(canvasPoint, data)");
const memberNameHitIndex = clickHandlerMatch[0].indexOf("const nameTarget = planNameLabelAt(canvasPoint)");
assert(slabHitIndex >= 0, "Slab-name clicks are not handled in normal plan mode");
assert(memberNameHitIndex >= 0, "Plan member-name click handling is missing");
assert(slabHitIndex < memberNameHitIndex, "Slab-name targets must take priority over overlapping beam-name targets");
assert(
  clickHandlerMatch[0].includes('nameTarget.hitDistance < slab.hitDistance'),
  "The closest visible plan label does not govern overlapping slab and beam hit targets"
);
assert(
  html.includes('hitDistance: Math.hypot(local.x - (target.box.x + target.box.w / 2), local.y - (target.box.y + target.box.h / 2))'),
  "Plan label targets do not retain their click distance"
);

const planDoubleClickMatch = html.match(/planCanvas\?\.addEventListener\("dblclick", event => \{[\s\S]*?\n        \}, true\);/);
assert(planDoubleClickMatch, "Structural Plan double-click handler is missing");
assert(
  planDoubleClickMatch[0].includes("slab.hitDistance <= target.hitDistance"),
  "A slab-name double-click can still fall through to an overlapping member rename target"
);

const expectedSortKeys = ["level", "name", "type", "width", "height", "length", "shear", "moment", "rebar"];
expectedSortKeys.forEach(key => {
  assert(html.includes(`data-beam-sort="${key}"`), `Beam sort header is missing: ${key}`);
  assert(html.includes(`data-sort-${key}=`), `Beam row sort value is missing: ${key}`);
});
assert(/data-beam-sort="level">Level/.test(html), "Beam X/YAXF header was not replaced by Level");

console.log("slab and beam MPR regression tests: passed");
