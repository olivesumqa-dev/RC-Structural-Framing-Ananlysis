"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

assert(html.includes('id="isoShowWalls"') && html.includes('id="isoShowWallFootings"'),
  "The 3D ISO toolbar must provide Walls and Wall Footings visibility controls");
assert(html.includes('wallFootings: true, walls: true, columns: true, beams: true'),
  "Walls and Wall Footings must be visible in a new 3D ISO view by default");
assert(html.includes("const isoWallVolumes = Object.entries(planState.levelWalls || {})")
  && html.includes("const isoWallFootingVolumes = (planState.wallFootings || [])"),
  "3D ISO must build geometry from the actual wall and wall-footing data");
assert(html.includes("drawIsoSegmentPrism(volume, \"rgba(39, 132, 79, 0.52)\", \"#6ff19a\")")
  && html.includes("drawIsoSegmentPrism(volume, \"rgba(214, 196, 151, 0.32)\", \"#f5dc8a\")"),
  "3D ISO must render visible wall-footing and wall solids with their distinct styles");

assert(html.includes('panelCanvas.toDataURL("image/png")'),
  "Raster panels must retain the source pixels without JPEG recompression");
assert(!html.includes("function rasterCornerBackground(") && !html.includes("function rasterStrokeProfile("),
  "The aggressive raster grid-inference release must remain removed");
assert(html.includes('if (extension === "dwf") await unsupportedDwfConversionError(file);'),
  "DWF validation must remain available without affecting raster conversion");
assert(/byId\("newDesign"\)\?\.addEventListener\("click", \(\) => \{\s*resetCadUploadState\(\);/.test(html),
  "Create New Design must clear the upload list");

assert(html.includes("function nearestPlanWallFooting(canvasPoint, data = makePlanData())")
  && html.includes("if (planState.activeLevelIndex !== -1) return null;"),
  "Wall Footings must be detected only on the FOUNDATION plan");
assert(html.includes("function deletePlanWallFooting(footing, data = makePlanData())")
  && html.includes('planState.wallFootings = planState.wallFootings.filter(item => item.id !== footing.id);'),
  "The delete tool must remove the selected Wall Footing");
assert(html.includes('wall?.wallFootingId !== footing.id')
  && html.includes('const overlappingObjects = planOverlapCandidates(canvasPoint, data, true);'),
  "Deleting a Wall Footing must remove its linked wall and offer it in an overlapping-object chooser");
assert(css.includes('.overlap-object-dialog{width:min(480px,calc(100vw - 32px));background:#948B8A!important;color:#000!important}')
  && css.includes('background:#F7CB8D!important;color:#000!important'),
  "The selection object dialog must use the requested background and button colors");

console.log("3D walls/wall-footings, deletion, dialog styling, and safe raster rollback regression checks passed.");
