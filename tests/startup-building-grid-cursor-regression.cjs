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
assert(html.includes('https://www.strucforge.com/assets/mascot-cursor.js?v=production-1'), "The deployed RC app must load the production mascot cursor");

console.log("Startup template, building grid, wall tool, and cursor checks: passed");
