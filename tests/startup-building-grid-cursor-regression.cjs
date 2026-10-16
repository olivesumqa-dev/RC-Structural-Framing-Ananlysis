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
assert(!html.includes('<script src="https://www.strucforge.com/assets/mascot-cursor.js'), "The deployed RC app must leave the mascot cursor paused");
assert(html.includes("const CURSOR_PROTOTYPE_PAUSED = true"), "The local cursor prototype must remain paused during development");
assert(/\.header-disclaimer\s*\{[^}]*font-size:\s*10px;[^}]*text-align:\s*center;[^}]*align-items:\s*center;/.test(html), "The upper-right disclaimer must use the corrected readable size and centered header alignment");
assert(/\.header-disclaimer\s*\{[^}]*border-right:\s*0;/.test(html), "The disclaimer must not add a divider line to the header");
assert(html.includes('title="Aux. Grid Tool"') && html.includes('>AUX. GRID TOOL</h3>'), "The auxiliary grid tool must use its short requested name");
assert(!html.includes('<summary>Wall load along beam</summary>'), "The obsolete Wall Load Along Beam sidebar control must not be rendered");
assert(html.includes('renderXAxisUdlBands') && html.includes('drawXAxisUdlBand') && html.includes('WALL ${wall.toFixed(2)} | D ${dead.toFixed(1)} | L ${live.toFixed(1)} kN/m'), "X-frame wall loads must be combined into readable clear bands");
assert(html.includes('"#fff200"'), "WL and EQ frame labels must use bright yellow text");
assert(html.includes('function drawFixedFrameUdlBand') && html.includes('drawFixedFrameUdlBand(ctx, member, a, b, label, color, renderedLoadTargets.Y)') && html.includes('drawFixedFrameUdlBand(ctx, xMember, start, end'), "X and Y frames must share one distributed-load presentation primitive");
assert(html.includes('font: "700 9px Arial"') && html.includes('const depth = 18;'), "Frame load labels and arrows must use fixed screen-pixel presentation sizes");
assert(app.includes('function viewScale()') && app.includes('return 1;'), "Drawing annotations must not scale with drawing zoom");
assert(app.includes('Keep the first, deliberate annotation offset') && html.includes('Do not make drawing annotations hop between collision candidates'), "Drawing labels must retain stable CAD-style anchors during pan and zoom");
assert(html.includes('app.js?v=78'), "The fixed annotation renderer must use a new script revision rather than a stale browser cache");

console.log("Startup template, building grid, wall tool, and cursor checks: passed");
