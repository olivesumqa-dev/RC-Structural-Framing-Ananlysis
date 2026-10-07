const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert(html.includes('id="generateLoadsQuick"') && html.includes('id="calculateQuickBtn"'), "Quick Generate Loads and Calculate copies must appear below MSBM 6");
assert(html.includes('byId("generateLoadsQuick")?.addEventListener("click", generateEngineeringLoads)') && html.includes('byId("calculateQuickBtn")?.addEventListener("click"'), "Quick load and calculation buttons must execute the original actions");
assert(html.includes('[byId("toolbarCalcBtn"), byId("calculateBtn"), byId("calculateQuickBtn")]'), "Both Calculate copies must share red/green calculation state");
assert((html.match(/<section class="sidebar-package is-collapsed"/g) || []).length === 6, "All six MSBM packages must start collapsed");
assert(html.includes("window.setTimeout(() => collapse(section), 60000)"), "An open MSBM package must auto-close after one minute without activity");
assert(html.includes('id="sidebarVisibilityBtn"') && html.includes('id="sidebarShowBtn"') && html.includes("function installSidebarVisibility()"), "The sidebar needs working Hide and Show controls");
assert(html.includes("function installSidebarPackageReordering()") && html.includes("strucforgeMsbmOrder") && html.includes("setPointerCapture"), "MSBM packages must support persistent vertical pointer reordering");
assert(css.includes("body.sidebar-hidden .panel{display:none!important}") && css.includes(".msbm-drag-handle"), "Sidebar hiding and visible vertical drag handles need styling");

console.log("Sidebar workflow control regression tests: passed");
