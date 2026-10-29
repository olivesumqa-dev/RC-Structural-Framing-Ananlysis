const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");

assert(html.includes('id="planSlabOnFillToolBtn"'), "Slab on Fill Tool button is missing from the plan toolbar.");
assert(html.includes('customSlabs: []') && html.includes('slabOutlinePoints: []'), "Slab outline state is missing.");
assert(html.includes('planCustomSlabs: deepCopy(planState.customSlabs)'), "Slab-on-fill outlines must be saved with the project.");
assert(html.includes('function createSlabOnFillOutlineAt'), "Line-based slab-on-fill creator is missing.");
assert(html.includes('planState.activeLevelIndex) !== 0'), "Slab on Fill Tool must be restricted to Level-1.");
assert(html.includes('Slab on Fill created from the closed outline. No Level-1 tie-beam boundary was added.'), "The tool must create an independent slab without tie beams.");
assert(html.includes('function customSlabRegions'), "Custom slab outlines must join the slab region model.");
assert(html.includes('region.slabOnFill ? "SLAB_ON_FILL"'), "Custom outlines must be designed as slab-on-fill.");
assert(html.includes('if (region.customSlab) return "SLAB ON FILL"'), "Custom outlines must be labelled as slab on fill in plan view.");

console.log("Slab-on-fill outline regression checks passed.");
