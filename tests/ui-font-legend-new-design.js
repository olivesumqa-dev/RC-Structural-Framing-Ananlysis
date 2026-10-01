"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert(css.includes('font-family:"Aptos Light","Aptos",Arial,sans-serif!important'), "Aptos Light must be applied to the complete UI without changing sizes");
assert(css.includes('font-weight:300!important'), "All UI text must use the Aptos Light weight");
assert(html.includes('<table class="legend-table"'), "Legend must use a structured table");
assert(html.includes("function installLegendMenu()") && css.includes(".legend-menu[open] .legend-content{display:block}"), "Legend must have a working explicit open/close controller");
assert(html.includes("Gross concrete section area") && html.includes("Demand-to-capacity ratio") && html.includes("Strength-reduction factor"), "Expanded structural legend items are missing");
assert(!html.includes("DL+SW kN/m") && !html.includes("SW kN/m"), "Separate MPR self-weight columns must be removed");
assert(html.includes("<th>DL, kN/m</th>"), "Combined dead load must be labeled DL");
assert(html.includes("Structural Design Tools"), "Sidebar title was not updated");
assert(html.includes("CREATE NEW DESIGN") && html.includes("This will delete all existing drawing"), "CREATE NEW DESIGN label or warning tooltip is missing");
assert(html.includes("Are you sure to continue?") && html.includes('id="newDesignConfirmNo"') && html.includes('id="newDesignConfirmYes"'), "New Design No/Yes confirmation is missing");
assert(css.includes(".panel button{border-color:#F3AD4B!important}"), "Sidebar buttons must use the #F3AD4B activity border");
assert(css.includes("background:#92C7C9!important"), "Sidebar package headers must use #92C7C9");
assert(css.includes("#newDesignConfirmDialog,#uploadDrawingsConfirmDialog{position:fixed;width:min(252px"), "New Design and Upload Drawings confirmations must use the compact high-contrast layout");
assert(html.includes('id="uploadDrawingsConfirmDialog"') && html.includes("This will delete all existing drawings. Are you sure you want to continue?"), "Upload Drawings must use the revised custom confirmation dialog");
assert(!html.includes('window.confirm("Are you sure you want to delete all drawings?")'), "Upload Drawings must not use the browser's top-centred confirmation");
assert(css.includes("#newDesignConfirmDialog,#uploadDrawingsConfirmDialog"), "Upload Drawings and New Design confirmations must share one compact design");
assert(html.includes("openCompactSidebarDialog(dialog, anchor"), "Compact confirmations must be positioned beside their sidebar controls");
assert(css.includes("#saveTemplateDialog #saveTemplateConfirm") && css.includes("#saveTemplateDialog #saveTemplateCancel"), "Save-template action contrast rules are missing");
assert(css.includes("#newDesignConfirmDialog .girder-direction-cancel,#uploadDrawingsConfirmDialog .girder-direction-cancel{grid-column:auto!important}"), "Upload confirmation NO and YES buttons must occupy equal grid columns");

console.log("UI font, legend, MPR dead-load, and New Design regression tests: passed");
