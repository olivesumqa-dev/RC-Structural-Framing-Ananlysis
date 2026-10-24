"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert(html.includes("function canonicalStructuralMemberName(value)"), "A shared structural-member naming rule must exist");
assert(html.includes('if (/^[A-Z]{2}$/.test(token))'), "Two-letter spans must be alphabetically ordered and uppercase");
assert(html.includes('if (/^\\d{2}$/.test(token))'), "Two-digit spans must be numerically ordered");
assert(html.includes("return canonicalStructuralMemberName(columnNameOverride(key, storyIndex) || defaultPlanColumnName(key, storyIndex));"), "Column names must use the canonical naming rule");
assert(html.includes("const normalizedName = canonicalStructuralMemberName(nextName);"), "User-renamed members must use the canonical naming rule");
assert(html.includes("name: canonicalStructuralMemberName(override || id)"), "Generated beam groups must use canonical names");

assert(html.includes("row.querySelector('[data-field=\"longitudinalBarDiameter\"]')?.value"), "Beam estimates must read the actual longitudinal-rebar selector rather than a fragile cell number");
assert(html.includes("row.querySelector('[data-field=\"stirrupDiameter\"]')?.value"), "Beam estimates must read the actual stirrup selector rather than a fragile cell number");
assert(!html.includes("const longitudinalDiameter = structuralEstimateCellValue(row, 18);"), "Beam deflection must never be mistaken for a rebar diameter");

function canonicalStructuralMemberName(value) {
  return String(value || "").trim().toUpperCase().split("-").map((token, index) => {
    if (index === 0) return token;
    if (/^[A-Z]{2}$/.test(token)) return token.split("").sort((a, b) => a.localeCompare(b)).join("");
    if (/^\d{2}$/.test(token)) return token.split("").sort((a, b) => Number(a) - Number(b)).join("");
    return token;
  }).join("-");
}

assert.strictEqual(canonicalStructuralMemberName("B2-2-cb"), "B2-2-BC");
assert.strictEqual(canonicalStructuralMemberName("B2-C-32"), "B2-C-23");
assert.strictEqual(canonicalStructuralMemberName("C1-a2"), "C1-A2");

console.log("Structural-estimate rebar and member-name rule checks passed.");
