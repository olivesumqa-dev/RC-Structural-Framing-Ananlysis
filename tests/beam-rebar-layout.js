"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

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

function sourceConstant(name) {
  const match = html.match(new RegExp(`const ${name} = [^;]+;`));
  assert(match, `${name} constant is missing`);
  return match[0];
}

const api = Function(
  `${sourceConstant("BEAM_MINIMUM_TENSION_STRAIN")}
   ${sourceConstant("BEAM_TENSION_CONTROLLED_STRAIN")}
   ${sourceConstant("BEAM_LONG_SPAN_THRESHOLD_M")}
   ${sourceConstant("BEAM_LONG_SPAN_STEEL_AREA_FACTOR")}
   ${sourceConstant("REBAR_ELASTIC_MODULUS")}
   ${sourceFunction("beamLongSpanSteelFactor")}
   ${sourceFunction("concreteBeta1")}
   ${sourceFunction("beamStrengthReductionFactor")}
   ${sourceFunction("beamBarLayout")}
   ${sourceFunction("beamBarCentroidDepth")}
   ${sourceFunction("beamFlexuralResponse")}
   ${sourceFunction("selectBeamFlexuralLayout")}
   ${sourceFunction("beamScheduleUtilization")}
   ${sourceFunction("governingBeamGroupSchedule")}
   return {beamLongSpanSteelFactor, beamBarLayout, beamBarCentroidDepth, selectBeamFlexuralLayout, governingBeamGroupSchedule};`
)();

assert.strictEqual(api.beamLongSpanSteelFactor(3.999), 1, "The 12% reserve must not apply below 4.00 m");
assert.strictEqual(api.beamLongSpanSteelFactor(4.00), 1.12, "The 12% reserve must start at 4.00 m");

const sevenD21 = api.beamBarLayout(300, 40, 10, 21, 7);
const sixD22 = api.beamBarLayout(300, 40, 10, 22, 6);
assert.deepStrictEqual(sevenD21.layerCounts, [4, 3], "7-D21 must be arranged as four bars plus three bars");
assert.deepStrictEqual(sixD22.layerCounts, [4, 2], "6-D22 must be arranged as four bars plus two bars");
assert(Math.abs(api.beamBarCentroidDepth(500, 40, 10, 21, sevenD21) - 419.785714) < 1e-5, "7-D21 centroid depth is incorrect");
assert(Math.abs(api.beamBarCentroidDepth(500, 40, 10, 22, sixD22) - 423.333333) < 1e-5, "6-D22 centroid depth is incorrect");

const common = [300, 500, 40, 10];
const design21 = api.selectBeamFlexuralLayout(...common, 21, 303.76, 28, 415);
const design22 = api.selectBeamFlexuralLayout(...common, 22, 303.76, 28, 415);
assert.strictEqual(design21.count, 7, "303.76 kN-m should select 7-D21 for the regression section");
assert.strictEqual(design22.count, 6, "303.76 kN-m should select 6-D22 for the regression section");
assert(design21.pass, "7-D21 should pass the corrected strain-dependent flexural check");
assert(design22.pass, "6-D22 should pass the corrected strain-dependent flexural check");
assert(design21.tensileStrain >= 0.004 && design22.tensileStrain >= 0.004, "Both designs must satisfy the beam minimum tensile strain");
assert(design21.phi < 0.90 && design22.phi === 0.90, "The transition-region design must use a reduced phi while the tension-controlled design uses phi=0.90");

const constrainedReserve = api.selectBeamFlexuralLayout(...common, 21, 303.76, 28, 415, api.beamLongSpanSteelFactor(4.00));
assert(!constrainedReserve.pass && constrainedReserve.steelReservePass === false, "A section that cannot hold the 12% reserve without violating ductility must fail for resizing");

const longSpanCommon = [300, 550, 40, 10];
const longSpanBaseline = api.selectBeamFlexuralLayout(...longSpanCommon, 21, 303.76, 28, 415);
const longSpanReserved = api.selectBeamFlexuralLayout(...longSpanCommon, 21, 303.76, 28, 415, api.beamLongSpanSteelFactor(4.00));
assert(longSpanReserved.pass, "The long-span reserve layout must retain all flexural acceptance checks");
assert(longSpanReserved.count > longSpanBaseline.count, "The long-span reserve must increase the whole main-bar count for the regression section");
assert(longSpanReserved.areaSteel + 1e-6 >= longSpanBaseline.areaSteel * 1.12, "The provided long-span main steel area must be at least 112% of baseline");
assert(longSpanReserved.fits, "The reserved bars must fit within the checked two-layer layout");
assert(longSpanReserved.tensileStrain >= 0.004, "The reserved layout must retain the minimum tensile strain");
assert.strictEqual(longSpanReserved.steelReservePass, true, "The reserve result must explicitly report that the project rule passed");

const governing = api.governingBeamGroupSchedule([
  {memberName: "passing segment", pass: true, flexureRatio: 0.99, shearRatio: 0.40, deflectionRatio: 0.20},
  {memberName: "failed segment", pass: false, reason: "FLEXURAL CAPACITY", flexureRatio: 0.97, shearRatio: 0.30, deflectionRatio: 0.10}
]);
assert.strictEqual(governing.memberName, "failed segment", "A failed girder segment must govern over a passing segment with a higher numeric ratio");
assert(!html.includes("effectiveDepth -= (layers - 1)"), "The obsolete fixed half-row centroid adjustment remains in the beam design code");

console.log("beam rebar layout regression tests: passed");
