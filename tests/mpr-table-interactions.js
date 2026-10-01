const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert(html.includes("Default member dimensions; you can edit them later in Member Properties / Results."), "Member Dimensions hover guidance is missing");
assert(css.includes("font:700 9px/1.3 Arial,sans-serif"), "Member Dimensions hover guidance must use a compact 9 px font");
assert(html.includes("function installMprTableScrolling()"), "MPR scroll-region installer is missing");
assert(css.includes(".mpr-table-scroll thead tr:last-child>th{position:sticky"), "MPR column headings must remain sticky while rows scroll");
assert(!css.includes(".mpr-table-scroll thead tr:last-child>th{position:sticky;top:0;z-index:6;background:"), "Sticky MPR headers must not override the established high-contrast theme colors");

["columnResultsTable", "slabResultsTable", "footingResultsTable"].forEach(tableId => {
  assert(html.includes(`${tableId}: {textColumns:`), `${tableId} is missing its sorting definition`);
});
assert(!html.includes('id="nodeResultsTable"') && !html.includes("X &amp; Y-AXIS FRAMES NODE FORCES RESULTS"), "The X/Y frame node-forces MPR table must be removed");
assert(html.includes("data.mprSortIndex") || html.includes("dataset.mprSortIndex"), "Generic MPR sort controls are missing");
assert(html.includes("applyAllAdditionalMprSorts();"), "Active MPR sort order must be reapplied after recalculation");
assert(html.includes('id="mprSolutionDialog"'), "MPR academic calculation dialog is missing");
assert(html.includes("function mprAcademicSolution(input)"), "Member-specific academic solution builder is missing");
assert(html.includes('panel.addEventListener("dblclick"'), "MPR member names must open the academic solution on double-click");
assert(html.includes("Gross concrete area") && html.includes("Service bearing pressure") && html.includes("Apply the panel moment coefficients"), "Academic walkthroughs must cover beams, columns, slabs, and footings");
assert(/\.design-status\.warn,\s*\.design-status\.fail\s*\{\s*color:\s*#F3AD4B;\s*\}/.test(html), "Every warning or failed MPR Status cell must use #F3AD4B text");
assert(/body\[data-theme="green_teal"\][^{]+td\.design-status\.fail\s*\{\s*color:\s*#F3AD4B\s*!important;/.test(html), "Night theme must not override the #F3AD4B non-passing MPR Status color");
assert(html.includes('.design-status.warn,.design-status.fail{color:#F3AD4B!important}'), "Printed/PDF MPR tables must preserve the non-passing Status font color");
assert(html.includes('background:#f8dddd;color:#F3AD4B') && html.includes('background:#fff0c7;color:#F3AD4B'), "Excel-exported warning and failure Status cells must preserve #F3AD4B text");

console.log("MPR table interaction regression tests: passed");
