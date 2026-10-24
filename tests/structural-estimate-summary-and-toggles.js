"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const overallMarkup = html.slice(
  html.indexOf("function structuralEstimateOverallMarkup"),
  html.indexOf("function refreshStructuralEstimateCosts")
);

assert(!overallMarkup.includes('"wallRebarD10"'), "The Overall Total Summary must not create a separate D10 wall-rebar row");
assert(!overallMarkup.includes('"wallCement"'), "The Overall Total Summary must not create a separate wall-cement row");
assert(!overallMarkup.includes('"wallSand"'), "The Overall Total Summary must not create a separate wall-sand row");
assert(overallMarkup.includes('wallMaterialKeys = new Set(["chb4", "chb6", "D10", "cement", "sand"])'), "Wall materials must feed the standard D10, cement, and sand rows");
assert(overallMarkup.includes('const overallQuantityValue = key =>'), "Overall quantities must combine wall values with structural values");
assert(html.includes('data-estimate-toggle aria-expanded="true"'), "Every estimate table must render a Show/Hide control");
assert(html.includes('class="structural-estimate-content"'), "Each estimate table must have independently collapsible content");
assert(html.includes('block?.classList.toggle("is-collapsed")'), "Show/Hide controls must toggle only their own estimate table");
assert(html.includes('background: #AEC8A7;'), "Structural Estimate header strips must use the requested background color");
assert(html.includes('"Premix Conc.<br>(cu.m.)"'), "Each Structural Estimate table must use the Premix Conc. material label");
assert(html.includes('["Premix Conc.", "cu.m.", "concrete"]'), "The Overall Total Summary must use the Premix Conc. material label");
assert(html.includes('>Premix Conc.</label>'), "The ready-mixed concrete option must be renamed to Premix Conc.");
assert(!html.includes('>Ready Mixed Concrete</label>'), "The old ready-mixed concrete label must not remain in Structural Estimates");

console.log("Structural Estimate summary consolidation and per-table toggle checks passed.");
