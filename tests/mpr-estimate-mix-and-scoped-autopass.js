const fs = require("fs");
const path = require("path");
const assert = require("assert");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert(html.includes('data-estimate-concrete-mode="site"'), "Site Mixing choice must be rendered");
assert(html.includes('data-estimate-concrete-mode="ready"'), "Ready Mixed Concrete choice must be rendered");
assert(!html.includes('<th>PRICE REFERENCE</th>'), "Price Reference column must be removed");
assert(!html.includes('id="structuralEstimateLocationPreset"'), "Location preset control must be removed");
assert(!html.includes('id="structuralEstimateExchangeRate"'), "Exchange-rate control must be removed");
assert(html.includes('data-estimate-selected-total'), "Only the selected concrete method total must be rendered");
assert(html.includes('structural-estimate-block is-collapsed'), "Structural Estimate member tables must start collapsed");
assert(html.includes('structural-estimate-overall-block'), "Overall Total Summary must be identifiable as the one default-open estimate table");
assert(html.includes('function resetStructuralEstimateDisclosureDefaults()'), "Structural Estimate disclosure defaults must be restored when the section opens");
assert(html.includes('#structuralEstimateCurrency') && html.includes('min-width: 245px !important'), "Currency selector must be wide enough for complete currency names");
assert(html.includes('${code} - ${escapeHtml(detail.label)}'), "Currency options must show code and full currency name");

for (const tableKey of ["beams", "columns", "slabs", "footings"]) {
  assert(html.includes(`"${tableKey}"`), `${tableKey} must be represented in the scoped AUTO-PASS table map`);
  assert(html.includes(`mprAutoPassEnabled("${tableKey}")`), `${tableKey} calculations must read their scoped AUTO-PASS state`);
}
assert(html.includes('data-mpr-auto-pass="${tableKey}"'), "AUTO-PASS controls must bind to their table key");
assert(html.includes("Other MPR tables are unchanged."), "Scoped AUTO-PASS feedback must confirm that other tables are unchanged");

console.log("Structural estimate concrete mode and scoped MPR AUTO-PASS regression tests: passed");
