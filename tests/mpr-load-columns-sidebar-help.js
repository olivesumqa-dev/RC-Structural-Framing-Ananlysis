"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert(html.includes("Member Properties / Results (MPR)"), "The requested MPR title is missing");
assert(!html.includes('id="mprExcelBtn"'), "The MPR Excel icon must be removed");
assert.strictEqual((html.match(/class="mpr-load-heading"/g) || []).length, 24, "Each of the four MPR tables must have six load-source columns");
assert(html.includes("function frameLoadCaseTotals(frameModel)"), "Frame load-source aggregation is missing");
assert(html.includes("function memberLoadSourceBreakdown(frameModel, member)"), "Beam load-source aggregation is missing");
assert(html.includes("function connectedColumnLoadSources(key, design)"), "Column and footing load-source aggregation is missing");
assert(html.includes("deadLoad: dead") && html.includes("liveLoad: live"), "Slab dead and live loads must remain traceable in the table");
assert(css.includes(".mpr-load-heading,.mpr-load-cell"), "Load-source columns need compact table styling");
assert(html.includes("function installSidebarLearningHelp()"), "Sidebar learning-help behavior is missing");
assert(html.includes("specified 28-day strength") && html.includes("allowable soil bearing pressure (ASB)"), "Material and soil inputs need value-first beginner explanations");
assert(html.includes("applied to the Roof Deck and Roof Beams only when selected"), "Solar-panel guidance must state its roof-only scope");
assert(html.includes("function installSidebarLearningHelp()") && html.includes("currentDataLine"), "Sidebar help must show each current value before its explanation");
assert(!css.includes(".mpr-load-heading,.mpr-load-cell{background:"), "Load columns must inherit the established MPR day/night table colors");
assert(css.includes(".mpr-load-cell.is-not-applied{opacity:1;color:inherit}"), "Empty load cells must retain their original column color");
assert(html.includes('return `<td class="mpr-load-cell is-not-applied" title="${escapeHtml(title)}">&mdash;</td>`;'), "Unavailable load cells must show a dash");
[
  "Upload drawings (Png image files only).",
  "Create your Structural Plans Here.",
  "Finish you Structl Plans by creating Columns, Beams & Footings",
  "Save / Open Project/s Here",
  "Default Struct'l Member Properties. Edit later in MPR to adjust sizes, reinforcements etc.",
  "Assign Loadings here & Calculate (e.g. LL, WL, EQ etc.)"
].forEach(message => assert(html.includes(message), `Missing sidebar package hover message: ${message}`));
assert(!html.includes('if (section.id === "uploadCadPackage" && section.classList.contains("is-collapsed"))'), "Opening Upload Drawings must not trigger destructive confirmation or clear drawings");
assert(css.includes("#beamResultsTable col{width:auto!important}"), "The expanded beam table must compress its columns to remain visible");
assert(html.includes("installSidebarLearningHelp();"), "Sidebar learning help is not installed on application load");
assert(html.includes("const sidebarSubgroupHelp") && html.includes('"Level Heights": "Input the floor-to-floor height in metres for every adjacent level pair, or accept the default values.'), "Orange sidebar groups must provide task-specific hover guidance");
assert(html.includes("attachSidebarSubgroupHelp(summary, title)"), "Generated orange sidebar headings must receive contextual hover guidance");
assert(app.includes("window.strucForgeToggleTutorials"), "Tutorial button does not expose the repaired drawer control");
assert(html.includes('app.js?v=72'), "The repaired drawing behavior must bypass the previous cached script");
assert(html.includes('styles.css?v=60'), "The sticky MPR and drawing-tool styles must bypass the previous cached stylesheet");
assert(html.includes('"structural-wall-plan", "manual-wall-plan", "manual-wall"'), "All structural and assigned wall-load sources must be reported in MPR load records");
assert(html.includes('`WALL ${total.toFixed(2)} kN/m`') && html.includes('`WALL ${wallLoad.toFixed(2)} | D ${deadLoad.toFixed(1)} | L ${liveLoad.toFixed(1)} kN/m`') && html.includes("immediateWallPointLoads"), "X/Y frame views must label wall-load values and positions");

console.log("MPR load columns and sidebar guidance regression tests: passed");
