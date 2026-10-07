const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert(html.includes('id="generateLoadsQuick"') && html.includes('id="calculateQuickBtn"'), "Quick Generate Loads and Calculate copies must appear below MSBM 6");
assert(html.indexOf('id="calculateQuickBtn"') < html.indexOf('id="generateLoadsQuick"'), "Generate Loads must appear below the Calculate copy");
assert(html.includes('byId("generateLoadsQuick")?.addEventListener("click", generateEngineeringLoads)') && html.includes('byId("calculateQuickBtn")?.addEventListener("click"'), "Quick load and calculation buttons must execute the original actions");
assert(html.includes('[byId("engineeringLoadSummary"), byId("generatedLoadsQuickSummary")]'), "Quick Generate Loads must display the same generated-load list as the MSBM generator");
assert(html.includes('[byId("toolbarCalcBtn"), byId("calculateBtn"), byId("calculateQuickBtn")]'), "Both Calculate copies must share red/green calculation state");
assert((html.match(/<section class="sidebar-package is-collapsed"/g) || []).length === 6, "All six MSBM packages must start collapsed");
assert(html.includes("window.setTimeout(() => collapse(section), 60000)"), "An open MSBM package must auto-close after one minute without activity");
assert(html.includes('id="sidebarVisibilityBtn"') && html.includes('id="sidebarShowBtn"') && html.includes("function installSidebarVisibility()"), "The sidebar needs working Hide and Show controls");
assert(html.includes("function installSidebarPackageReordering()") && html.includes("strucforgeMsbmOrder") && html.includes('window.addEventListener("pointermove", move)'), "MSBM packages must support persistent document-level pointer reordering");
assert(css.includes("body.sidebar-hidden .panel{display:none!important}") && css.includes(".msbm-drag-handle"), "Sidebar hiding and visible reorder grips need styling");
assert(html.includes('handle.textContent = ""') && css.includes('.msbm-drag-handle::before{content:"";width:15px;height:2px') && css.includes("cursor:grab"), "MSBM reordering must use a borderless three-line grip rather than the table column-resize arrow");
assert(html.includes("toggle.appendChild(handle)") && css.includes(".msbm-index{flex:0 0 22px;margin-left:auto;text-align:center") && css.includes(".msbm-index+.msbm-drag-handle{margin-right:-5px}"), "MSBM numbers must share one aligned column and the reorder grip must be the far-right control");
assert(css.includes('#generateLoadsQuick{background:#03545E;color:#fff;border:1px solid #4f777a!important}'), "Generate Loads must not use an orange border");

console.log("Sidebar workflow control regression tests: passed");
