"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets", "persistence-manifest.json"), "utf8"));
const sample = JSON.parse(fs.readFileSync(path.join(root, "JSON", "2-STOREY SAMPLE.stf"), "utf8"));

assert.strictEqual(manifest.defaultProject, "2-STOREY SAMPLE");
assert.strictEqual(manifest.id, "2026-10-15-two-storey-sample-startup-v2");
assert.strictEqual(manifest.projects[0].source, "JSON/2-STOREY SAMPLE.stf");
assert(sample.model && sample.structuralProject?.workspace, "The startup STF must contain both frame and structural workspace data");
assert(app.includes('loadProjectPackage(data, "2-STOREY SAMPLE.stf"'), "Embedded fallback must use the new sample name");
assert(html.indexOf('id="modeNode"') < html.indexOf('id="modeColumn"'), "Create Node must appear before Create Column");
assert(!html.includes('id="modeWall"'), "The sidebar Structural Wall Tool entry must be removed");
assert(html.includes('id="planWallToolBtn"'), "The drawing-toolbar Wall tool must remain available");
assert(html.includes('id="buildingGridToolBtn"') && html.includes('id="buildingGridDialog"'), "Bldg. Grid Tool and dialog are required");
assert(html.includes('buildingGridNodeEndpoint(nearestBuildingGridNode'), "Building-grid intersections must participate in magnetic snapping");
assert(html.includes('planBuildingGrid: deepCopy(planState.buildingGrid)'), "Building-grid settings must persist in project snapshots");
assert(html.includes('ctx.lineWidth = 5.1;') && html.includes('ctx.strokeStyle = "#ff3131";'), "Wall boundaries must be bright red and exactly three times thicker");
assert(html.includes('https://www.strucforge.com/assets/mascot-cursor.js?v=production-3'), "The deployed RC app must load the current production mascot cursor");
assert(/\.header-disclaimer\s*\{[^}]*font-size:\s*10px;[^}]*text-align:\s*center;[^}]*align-items:\s*center;/.test(html), "The upper-right disclaimer must use the corrected readable size and centered header alignment");
assert(/\.header-disclaimer\s*\{[^}]*border-right:\s*0;/.test(html), "The disclaimer must not add a divider line to the header");
assert(html.includes('title="Aux. Grid Tool"') && html.includes('>AUX. GRID TOOL</h3>'), "The auxiliary grid tool must use its short requested name");
assert(!html.includes('<summary>Wall load along beam</summary>'), "The obsolete Wall Load Along Beam sidebar control must not be rendered");
assert(html.includes('wallLoad: 0') && html.includes('WALL ${wall.toFixed(2)} | D ${dead.toFixed(1)} | L ${live.toFixed(1)} kN/m'), "X-frame wall loads must share one combined readable load band");
assert(html.includes('"#fff200"'), "WL and EQ frame labels must use bright yellow text");

console.log("Startup template, building grid, wall tool, and cursor checks: passed");
