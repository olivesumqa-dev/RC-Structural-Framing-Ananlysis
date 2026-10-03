"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert(app.includes('const fontScaleSelect = document.getElementById("fontScaleSelect")'), "Text Size must use an explicit control reference");
assert(app.includes("function applyFontScale") && app.includes('fontScaleSelect.onchange = () => applyFontScale(fontScaleSelect.value)'), "Text Size must use one reliable scaling path");
assert(app.includes("window.strucForgeRedrawScaledViews?.();"), "Text Size must redraw every coordinated view");
assert(html.includes("window.strucForgeRedrawScaledViews = () =>") && html.includes("drawIsometricStructure(makePlanData());"), "Plan, frame and 3D ISO views must respond to Text Size");
assert(html.includes('localStorage.getItem("strucforge_font_scale")'), "The saved Text Size must be restored instead of overwritten on startup");
assert(html.includes("function scaledDrawingTextSize(size, minimum = 6)") && html.includes("scaledDrawingTextSize(fontSize)"), "3D ISO and auxiliary drawing fonts must apply the selected Text Size scale");

const embeddedProjectMatch = html.match(/<script id="defaultProjectData" type="application\/json">\s*([\s\S]*?)\s*<\/script>/);
assert(embeddedProjectMatch, "A default project package must be embedded for startup");
const embeddedProject = JSON.parse(embeddedProjectMatch[1]);
assert.strictEqual(embeddedProject.project?.title, "Dela Cruz Residence", "The supplied 2-STO. BLDG project must be the embedded startup package");
assert(embeddedProject.structuralProject?.workspace, "The default project must include the coordinated structural workspace");
assert(app.includes('loadProjectPackage(data, "2-STO. BLDG"') && app.includes('recordName.value = "2-STO. BLDG"'), "Startup must identify the supplied package as 2-STO. BLDG");

assert(html.includes('function selectedRoofOnlyComponentLoad()') && html.includes('checkedLoadTotal(["roofSolar", "roofEquipment"])'), "Solar and roof equipment need a dedicated roof-only load total");
assert(html.includes('floorDead: slab + floorFinishes') && html.includes('roofDead: slab + roofFinishes + roofOnlyEquipment'), "Roof-only loads must be excluded from floor area loads");
assert.strictEqual((html.match(/selectedComponentLoad\(\["roofWaterproofing", "roofCeiling"\]\) \+ selectedRoofOnlyComponentLoad\(\)/g) || []).length, 2, "Both coordinated beam-load generators must use the roof-only component helper");
assert(html.includes('const sdl = (isRoof ? roofSdl : floorSdl)') && html.includes('(roof ? context.roofSdl : context.floorSdl)'), "Roof-only SDL must be assigned only at the roof elevation");

assert(css.includes("table{table-layout:auto!important;width:100%!important;font-size:11px!important}"), "MPR tables must auto-fit columns and show data 10% larger");
assert(css.includes("field-sizing:content"), "Editable MPR cells must size from their displayed values");
assert(css.includes("max-width:150px;white-space:normal!important;overflow-wrap:anywhere!important"), "Long MPR content must wrap within a bounded width and gain vertical space");
assert(!css.includes("table{table-layout:fixed!important;font-size:9px!important}"), "The old fixed, undersized MPR layout must be removed");

console.log("Text Size, roof-only loads, and responsive MPR layout regression tests: passed");
