const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert(html.includes("function installMprAutoPassControls()"), "MPR AUTO-PASS controls are not installed");
for (const id of ["beamResultsSection", "columnResultsSection", "slabResultsSection", "footingResultsSection"]) {
  assert(html.includes(`[\"${id}\"`), `${id} needs an AUTO-PASS control`);
}
assert(!html.includes('["structuralEstimatesSection", "Structural Estimates"]'), "Structural Estimates must not receive AUTO-PASS");
assert(html.includes("SHOW / HIDE Members") && html.includes('id="mprShowMembersApply"'), "The member visibility dialog needs both show and hide actions");
assert(html.includes("mprVisibilityState.hiddenRows.delete(row.dataset.mprRowKey)"), "SHOW MEMBERS must restore selected item numbers");
assert(html.includes('id="openRecordBtn"') && html.includes("Save in Browser") && html.includes("Save .STF File"), "Browser and portable STF save paths must be explicit");
assert(app.includes('openRecordButton.onclick = loadRecord') && app.includes("navigator.storage.persist()"), "Browser-saved STF projects need reopening and persistent-storage support");

console.log("MPR AUTO-PASS, show/hide, and browser STF persistence regression tests: passed");
