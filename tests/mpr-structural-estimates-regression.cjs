"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert(html.includes('id="structuralEstimatesSection"'), "Structural Estimates MPR section is missing");
assert(html.includes('id="structuralEstimatesTables"'), "Structural Estimates table host is missing");
assert(html.includes("function collectStructuralEstimates()"), "Structural estimate collector is missing");
assert(html.includes("function updateStructuralEstimates()"), "Structural estimate renderer is missing");
assert(html.includes("updateStructuralEstimates();"), "Structural estimates are not refreshed with MPR results");
assert(html.includes('commercialBarLength: 6'), "Rebars must be converted to 6 m commercial pieces");
assert(html.includes('Math.ceil((quantity.rebars.get(diameter) || 0) / STRUCTURAL_ESTIMATE_FACTORS.commercialBarLength)'), "Commercial rebar counts must round aggregated lengths to whole pieces");
assert(html.includes('...diameters.map(diameter => [`D${diameter}`, `D${diameter} rebar<br>(6 m pcs)`])'), "Only rebar diameters found in current MPR quantities should become estimate columns");
assert(html.includes('TOTAL — ${escapeHtml(category.label)}'), "Each member estimate table needs a total row");
assert(html.includes("OVER ALL TOTAL SUMMARY"), "Overall total summary is missing");
assert(html.includes('Cement<br>(40 kg bags)') && html.includes('Sand<br>(cu.m.)') && html.includes('Gravel<br>(cu.m.)'), "Concrete constituent columns are incomplete");
assert(html.includes('Water<br>(L)') && html.includes('Formwork<br>(sq.m.)') && html.includes('Tie wire<br>(kg)'), "Supporting reinforced-concrete materials are incomplete");
assert(html.includes('data-estimate-support-top=') && html.includes('data-estimate-tie-spacing='), "Designed beam and column reinforcement data is not exposed to the takeoff");
assert(html.includes('["structuralEstimatesSection", "structuralEstimatesToggle", "Structural estimates"]'), "Structural Estimates collapse control is not installed");
assert(html.includes("installMprTableScrolling();") && html.includes("installMprTableHeightResizing();") && html.includes("installMprColumnResizing();"), "Generated estimate tables must receive the standard MPR scrolling and resize interactions");
assert(html.includes("STRUCTURAL_ESTIMATE_PRICE_PRESETS") && html.includes("structuralEstimatePricingState"), "Location-aware editable estimate prices are missing");
assert(html.includes('id="structuralEstimateCurrency"') && html.includes('id="structuralEstimateExchangeRate"'), "Currency and editable exchange-rate selectors are missing");
assert(html.includes("data-estimate-unit-price") && html.includes("data-estimate-item-cost"), "Overall estimate rows need editable unit prices and calculated item costs");
assert(html.includes("SITE-MIX MATERIAL TOTAL") && html.includes("READY-MIX ALTERNATIVE TOTAL"), "Concrete pricing alternatives must avoid double counting");
assert(html.includes('id="structuralEstimatesPrintBtn"') && html.includes('id="structuralEstimatesPrintPdfBtn"'), "Structural Estimates needs aligned Print and Print PDF controls");
assert(html.includes("outputStructuralEstimatesMarkup()") && html.includes('printStandaloneOutput("Structural Estimates"'), "Structural Estimates print controls must be functional");
assert(/@media \(max-width: 1800px\)[\s\S]*?\.member-results-sheet \.mpr-table-scroll[\s\S]*?touch-action: pan-x pan-y/.test(html), "Compressed desktop, phone, and tablet MPR tables must pan horizontally with fixed-width columns");
assert(/@media \(max-width: 900px\)[\s\S]*?\.topbar[\s\S]*?overflow-x: auto/.test(html), "The mobile application header must pan horizontally");

console.log("MPR structural estimates regression tests: passed");
