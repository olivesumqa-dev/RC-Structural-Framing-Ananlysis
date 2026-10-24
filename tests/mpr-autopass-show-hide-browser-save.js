const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert(html.includes("function installMprAutoPassControls()"), "MPR AUTO-PASS controls are not installed");
assert(html.includes("function installMprShowOnlyControl(") && html.includes("function applyMprShowOnlyFilter("), "MPR Show only controls are not installed");
assert(html.includes('{value: "all", label: "ALL"}'), "Every MPR Show only dropdown needs an explicit ALL option");
assert(html.includes('select.className = "mpr-show-only-select"'), "Show only must use a one-click native dropdown");
assert(html.includes('<option value="" selected disabled>Show only</option><optgroup'), "The one-click dropdown must display Show only and group its direct choices");
assert(!html.includes('button.className = "mpr-show-only-button"') && !html.includes('menu.className = "mpr-show-only-menu"'), "Show only must not require a second popup click");
for (const id of ["beamResultsSection", "columnResultsSection", "slabResultsSection", "footingResultsSection", "wallFootingResultsSection"]) {
  assert(html.includes(`[\"${id}\"`), `${id} needs an AUTO-PASS control`);
}
assert(!html.includes('["structuralEstimatesSection", "Structural Estimates"]'), "Structural Estimates must not receive AUTO-PASS");
for (const key of ["beams", "columns", "slabs", "footings"]) {
  assert(html.includes(`${key}: {sectionId:`), `${key} needs a Show only table configuration`);
}
assert(!html.includes("wallFootings: {sectionId:") && !html.includes("estimates: {sectionId:"), "Wall Footing and Structural Estimates must not receive Show only controls");
assert(html.includes("SHOW / HIDE Members") && html.includes('id="mprShowMembersApply"'), "The member visibility dialog needs both show and hide actions");
assert(html.includes("mprVisibilityState.hiddenRows.delete(row.dataset.mprRowKey)"), "SHOW MEMBERS must restore selected item numbers");
assert(html.includes('id="openRecordBtn"') && html.includes("Save in Browser") && html.includes("Save .STF File"), "Browser and portable STF save paths must be explicit");
assert(app.includes('openRecordButton.onclick = loadRecord') && app.includes("navigator.storage.persist()"), "Browser-saved STF projects need reopening and persistent-storage support");
assert(html.includes("mprSoilPassStatusMarkup(design.status, design.statusClass === \"pass\")"), "Footing PASS needs the scaled soil-report qualifier");
assert(html.includes("mprSoilPassStatusMarkup(statusText, verifiedPass)"), "Wall Footing PASS needs the scaled soil-report qualifier");

console.log("MPR AUTO-PASS, show/hide, and browser STF persistence regression tests: passed");
