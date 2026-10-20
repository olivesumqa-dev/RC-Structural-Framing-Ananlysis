"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert.match(
  html,
  /function slabRegionPlanLabel\(region,[\s\S]*?return `S-\$\{slabRegionCode\(region, data\)\}`;/,
  "Plan slab labels must retain their coordinate-based designation"
);
assert(!/planNameLabelTargets\.push\(\{[\s\S]{0,120}?kind: "slab"/.test(html),
  "Plan slab labels must not be exposed as rename targets");
assert(html.includes('data-member-rename="slab"'),
  "Slab IDs must remain editable in MPR");

console.log("fixed plan slab name and MPR-only slab rename checks: passed");
