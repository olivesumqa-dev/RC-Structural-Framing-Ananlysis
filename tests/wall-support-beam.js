"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function sourceFunction(name) {
  const start = html.indexOf(`function ${name}`);
  assert(start >= 0, `${name} function is missing`);
  const opening = html.indexOf("{", start);
  let depth = 0;
  for (let index = opening; index < html.length; index += 1) {
    if (html[index] === "{") depth += 1;
    if (html[index] === "}") depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`${name} function is incomplete`);
}

const wall = {
  levelIndex: 1,
  startPoint: {x: 0, y: 2},
  endPoint: {x: 5, y: 2}
};

const supportedApi = Function(`
  const makePlanData = () => ({});
  const planBeamSegmentsForLevel = () => [
    {id:"B1", axis:"X", frameLine:"2", startPoint:{x:0,y:2}, endPoint:{x:2.5,y:2}},
    {id:"B2", axis:"X", frameLine:"2", startPoint:{x:2.5,y:2}, endPoint:{x:5,y:2}}
  ];
  ${sourceFunction("wallSupportingBeamCoverage")}
  return {wallSupportingBeamCoverage};
`)();
const supported = supportedApi.wallSupportingBeamCoverage(wall, {});
assert.strictEqual(supported.supported, true, "Adjacent collinear beam segments must provide continuous wall support");
assert(Math.abs(supported.coverage - 5) < 1e-9, "Continuous support coverage must equal wall length");

const unsupportedApi = Function(`
  const makePlanData = () => ({});
  const planBeamSegmentsForLevel = () => [
    {id:"B1", axis:"X", frameLine:"2", startPoint:{x:0,y:2}, endPoint:{x:2,y:2}},
    {id:"CROSS", axis:"Y", frameLine:"C", startPoint:{x:3,y:0}, endPoint:{x:3,y:4}}
  ];
  ${sourceFunction("wallSupportingBeamCoverage")}
  return {wallSupportingBeamCoverage};
`)();
const unsupported = unsupportedApi.wallSupportingBeamCoverage(wall, {});
assert.strictEqual(unsupported.supported, false, "A partial or crossing beam must not be accepted as continuous support below the wall");

const offGridApi = Function(`
  ${sourceFunction("structuralWallCoordinatesInFrame")}
  ${sourceFunction("structuralWallSupportMatchesFrame")}
  return {structuralWallCoordinatesInFrame, structuralWallSupportMatchesFrame};
`)();
const offGridCoordinates = offGridApi.structuralWallCoordinatesInFrame(
  {startPoint: {x: 10, y: 20}, endPoint: {x: 14, y: 20}},
  {planTransferBeam: true, transferEndpoints: [{x: 10, y: 20}, {x: 14, y: 20}]},
  "X",
  30
);
assert.deepStrictEqual(offGridCoordinates, {start: 0, end: 4}, "Off-grid Wall Tool loads must be converted to the transfer frame's local coordinates");
assert.strictEqual(
  offGridApi.structuralWallSupportMatchesFrame({member: {axis: "X", id: "PLAN-7", generated: false}}, "X", "OFFSET:PLAN-7"),
  true,
  "An off-grid supporting beam must match its generated transfer-frame line"
);

const clippingApi = Function(`
  const makePlanData = () => ({});
  ${sourceFunction("slabCellModelBounds")}
  ${sourceFunction("wallLengthInsideSlabRegion")}
  return {wallLengthInsideSlabRegion};
`)();
const clippedLength = clippingApi.wallLengthInsideSlabRegion(
  {levelIndex: 1, startPoint: {x: 0, y: 1}, endPoint: {x: 4, y: 1}},
  {levelIndex: 1, cells: [{xIndex: 0, yIndex: 0}]},
  {xPos: [1, 3], yPos: [0, 2]}
);
assert(Math.abs(clippedLength - 2) < 1e-9, "Slab wall-load allocation must use the exact wall length inside the panel");

assert(html.includes('<button id="modeNode">Create Node</button>'), "Model Creation must label Node Mode as Create Node");
assert(html.includes('<button id="modeMember">Create Beams</button>'), "Model Creation must label member creation as Create Beams");
assert(app.includes('status("Create Beams active.'), "Create Beams must report its active workflow in Current Processes");
assert(html.includes("function wallSupportBeamRecommendation"), "Unsupported walls need a calculated support-beam recommendation");
assert(html.includes("Mu=wuL²/8") && html.includes("Vu=wuL/2"), "Support-beam calculation must expose the governing engineering equations");
assert(html.includes("SLAB FAILS") && html.includes("wallSupportFailures"), "Affected slab results must fail when a wall has no continuous beam below it");
assert(html.includes('source: "structural-wall-plan"'), "Supported Wall Tool loads must enter the analytical frame model");
assert(html.includes("function synchronizeStructuralWallOutputs") && (html.match(/synchronizeStructuralWallOutputs\(data\)/g) || []).length >= 2, "Wall creation and deletion must immediately synchronize frame and MPR data");
assert(html.includes("applyStoredPlanLoadsToFrame(source.model, axis, frameLine)") && html.includes("applyStoredPlanLoadsToFrame(transferModel, axis, frameLine)"), "Grid and off-grid frame catalog entries must refresh stored plan loads");
assert(app.includes("drawLoads({assignedOnly: true})") && html.includes("const assignedMemberLoads = rawMemberLoads.filter"), "Assigned wall loads must remain visible in X and Y frames while recalculation is pending");
assert(html.includes("recommendation.midspanBottom") && html.includes("recommendation.stirrupDiameter"), "The recommendation must include longitudinal bars and stirrups");
assert(html.includes("function structuralWallWeightAtLevel"), "Wall Tool dead load must be included in story weight");
assert((html.match(/\+ wallWeight \+ additionalWeight/g) || []).length >= 2, "Wall weight must enter both current story-weight calculation paths");
assert(html.includes('ctx.strokeStyle = "#ffffff"') && html.includes("ctx.lineWidth = 0.8"), "Wall Tool centerline must be thin and white");
assert(html.includes('color: "#00c853"') && html.includes("drawNonOverlappingText(ctx, wall.name"), "Plan wall labels must show only the wall name in green");
assert(html.includes("function memberPermanentLoadBreakdown") && html.includes('load.source === "structural-wall-plan"'), "Beam MPR dead load must include supported Wall Tool loads");
assert(html.includes("function slabWallLoadSummary") && html.includes("deadWithWall") && html.includes("wallDeadPressure"), "Slab MPR design must include unsupported Wall Tool load in factored demand");
assert(html.includes('class="mpr-load-heading">Wall, kN/m</th>') && html.includes("design.wallDeadPressure"), "Beam and slab MPR tables must disclose Wall Tool load in dedicated columns");

console.log("wall load-path and support-beam recommendation regression tests: passed");
