const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert(html.includes("Edit and recalculate repeatedly until PASS; individual MPR member sizes remain independent."), "Iterative Member Dimensions hover guidance is missing");
assert(html.includes('function applySidebarMemberDimensions(memberType)') && html.includes('applyUserDefaultSections(memberType);'), "Sidebar dimensions must immediately propagate to the selected global member type");
assert(html.includes('if (!applyBeams || member.userSectionOverride) return;') && html.includes('if (!applyColumns || columnMemberHasManualSection(member)) return;'), "Global sidebar dimensions must preserve individual beam and column MPR overrides");
assert(html.includes('member.designStatus = "DEFAULT-SIZED - RECALCULATE";'), "Members updated from the sidebar must be marked for recalculation");
assert(css.includes("font:700 9px/1.3 Arial,sans-serif"), "Member Dimensions hover guidance must use a compact 9 px font");
assert(html.includes("function installMprTableScrolling()"), "MPR scroll-region installer is missing");
assert(html.includes("function installMprColumnResizing()") && html.includes("const minimumWidth = 56") && html.includes("const maximumWidth = 260"), "MPR columns must be user-resizable within safe readable limits");
assert(css.includes(".mpr-column-resizer") && css.includes("cursor:col-resize"), "MPR resizable headings need an obvious drag handle");
assert(html.includes("function installDraggableDialogs()") && html.includes("const onBackdrop =") && html.includes("installDraggableDialogs();"), "All popup dialogs must support dragging from any non-control portion while excluding the backdrop");
assert(html.includes('<span class="mpr-title-text">Member Properties / Results (MPR)</span>'), "The main results heading must use the requested full MPR title");
assert(css.includes('.mpr-title-text{font-family:"Aptos Light",Aptos,Arial,sans-serif;font-size:16px;font-weight:300;line-height:1;color:#fff'), "The MPR title must use white Aptos Light text on the green strip");
assert(css.includes('letter-spacing:.08em;background:#16845b;color:#fff'), "The main MPR strip must use the calculated-state green with white text");
assert(css.includes('.results-subsection.is-collapsed,.member-props-table.is-collapsed{overflow:hidden!important;scrollbar-width:none!important}'), "Collapsed MPR tables must not show a vertical scrollbar");
assert(css.includes(".mpr-table-scroll{position:relative;width:100%;max-height:420px;overflow-x:hidden;overflow-y:auto"), "MPR tables must keep vertical scrolling without a horizontal slider");
assert(css.includes(".mpr-table-scroll thead tr:last-child>th{position:sticky"), "MPR column headings must remain sticky while rows scroll");
assert(css.includes(".mpr-resizable-heading{position:sticky!important;top:0!important;z-index:12!important}"), "Resizable MPR column headings must retain sticky positioning");
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
assert(html.includes("function mprAcademicLoadSteps") && html.includes('name: "Wall load"') && html.includes('name: "Earthquake load (EQ)"'), "Every academic solution must identify all loads affecting its member");
assert(/\.design-status\.warn,\s*\.design-status\.fail\s*\{\s*color:\s*#F3AD4B;\s*\}/.test(html), "Every warning or failed MPR Status cell must use #F3AD4B text");
assert(/body\[data-theme="green_teal"\][^{]+td\.design-status\.fail\s*\{\s*color:\s*#F3AD4B\s*!important;/.test(html), "Night theme must not override the #F3AD4B non-passing MPR Status color");
assert(html.includes('.design-status.warn,.design-status.fail{color:#F3AD4B!important}'), "Printed/PDF MPR tables must preserve the non-passing Status font color");
assert(html.includes('background:#f8dddd;color:#F3AD4B') && html.includes('background:#fff0c7;color:#F3AD4B'), "Excel-exported warning and failure Status cells must preserve #F3AD4B text");

console.log("MPR table interaction regression tests: passed");
