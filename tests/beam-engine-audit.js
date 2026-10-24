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
  `const byId = () => null;
   ${sourceConstant("BEAM_MINIMUM_TENSION_STRAIN")}
   ${sourceConstant("BEAM_TENSION_CONTROLLED_STRAIN")}
   ${sourceConstant("REBAR_ELASTIC_MODULUS")}
   ${sourceFunction("concreteBeta1")}
   ${sourceFunction("beamStrengthReductionFactor")}
   ${sourceFunction("beamBarLayout")}
   ${sourceFunction("beamBarCentroidDepth")}
   ${sourceFunction("beamFlexuralResponse")}
   ${sourceFunction("selectBeamFlexuralLayout")}
   ${sourceFunction("normalizedBeamFrameClassification")}
   ${sourceFunction("beamStirrupSpacingLimits")}
   return {beamStrengthReductionFactor, beamBarLayout, beamBarCentroidDepth, beamFlexuralResponse, selectBeamFlexuralLayout, beamStirrupSpacingLimits};`
)();

function referenceFlexure({width, height, cover, stirrup, diameter, count, moment, fc, fy, aggregate = 20, tolerance = 5}) {
  const clearWidth = width - 2 * (cover + stirrup + tolerance);
  const minimumClear = Math.max(25, diameter, 4 * aggregate / 3);
  const perLayer = Math.floor((clearWidth + minimumClear) / (diameter + minimumClear));
  const layers = Math.ceil(count / Math.max(perLayer, 1));
  const layerCounts = [];
  let remaining = count;
  while (remaining > 0 && layerCounts.length < 2 && perLayer > 0) {
    layerCounts.push(Math.min(perLayer, remaining));
    remaining -= Math.min(perLayer, remaining);
  }
  const firstDepth = height - cover - stirrup - diameter / 2;
  const centerSpacing = diameter + minimumClear;
  const centroidOffset = layerCounts.reduce((sum, bars, layer) => sum + bars * layer * centerSpacing, 0) / count;
  const d = firstDepth - centroidOffset;
  const area = count * Math.PI * diameter * diameter / 4;
  const beta1 = Math.max(0.65, Math.min(0.85, 0.85 - Math.max(0, fc - 28) * 0.05 / 7));
  const a = area * fy / (0.85 * fc * width);
  const c = a / beta1;
  const strain = 0.003 * (d - c) / c;
  const yieldStrain = Math.max(0.002, Math.min(0.005, fy / 200000));
  const phi = strain <= yieldStrain ? 0.65 : strain >= 0.005 ? 0.90 : 0.65 + 0.25 * (strain - yieldStrain) / (0.005 - yieldStrain);
  const capacity = phi * area * fy * (d - a / 2) / 1000000;
  return {clearWidth, minimumClear, perLayer, layers, layerCounts, d, area, a, c, strain, phi, capacity, ratio: moment / capacity, remaining};
}

// 1–2: tension-controlled and transition-region phi behavior.
assert.strictEqual(api.beamStrengthReductionFactor(0.006, 415), 0.90);
assert(api.beamStrengthReductionFactor(0.003, 415) > 0.65 && api.beamStrengthReductionFactor(0.003, 415) < 0.90);

// 3–5: two layers, horizontal spacing, and vertical package depth.
const fourBars = api.beamBarLayout(200, 40, 10, 16, 4, 20, 5);
assert.deepStrictEqual(fourBars.layerCounts, [2, 2], "4-D16 in the audited 200 mm beam must be arranged in two layers");
assert(fourBars.actualHorizontalClearSpacing >= fourBars.horizontalClearSpacing, "Accepted bars must meet aggregate-controlled horizontal clear spacing");
const shallow = api.beamFlexuralResponse(200, 150, 40, 10, 16, 4, 10, 21, 415, 20, 5);
assert.strictEqual(shallow.verticalFits, false, "A shallow section must reject a two-layer package that does not fit vertically");

// 6: insufficient flexural capacity must remain a failure.
const flexuralFailure = api.beamFlexuralResponse(200, 300, 40, 10, 16, 2, 250, 21, 415, 20, 5);
assert.strictEqual(flexuralFailure.strengthPass, false);

// 7–9: independent strength/ordinary/seismic stirrup limits.
const highShear = api.beamStirrupSpacingLimits(400, 16, 1e9, 28, 250, "ordinary");
assert(highShear.highShear && highShear.fieldMaximum <= 100);
const special = api.beamStirrupSpacingLimits(400, 16, 0, 28, 250, "special");
assert(special.seismicEndZone && special.supportMaximum <= Math.min(400 / 4, 6 * 16, 150));
const gravity = api.beamStirrupSpacingLimits(400, 16, 0, 28, 250, "gravity");
assert(!gravity.seismicEndZone && gravity.supportMaximum === gravity.fieldMaximum);

// 10: positive and negative moment regions are selected independently.
const positive = api.selectBeamFlexuralLayout(250, 450, 40, 10, 16, 35, 21, 415, 1, 20, 5);
const negative = api.selectBeamFlexuralLayout(250, 450, 40, 10, 16, 85, 21, 415, 1, 20, 5);
assert(negative.count >= positive.count, "Moment reversal regions must not reuse a smaller positive-moment bar count");

// 11: a high-shear/low-moment case is governed by the shear spacing branch.
assert(highShear.fieldMaximum < gravity.fieldMaximum);

// 12: the former four-bar one-layer assumption is no longer accepted.
assert.strictEqual(fourBars.perLayer, 2);

// 13: missing/nonphysical material input cannot produce a valid design.
const incomplete = api.beamFlexuralResponse(250, 450, 40, 10, 16, 4, 50, 0, 0, 20, 5);
assert(!Number.isFinite(incomplete.designCapacity) || !incomplete.pass);

// 14: Auto-PASS candidate selection must reject a section with no constructible layout.
const unconstructible = api.selectBeamFlexuralLayout(110, 250, 40, 10, 16, 20, 21, 415, 1, 20, 5);
assert.strictEqual(unconstructible.pass, false);

// 15: changing geometry changes capacity and therefore requires recalculation.
const shallowCapacity = api.beamFlexuralResponse(250, 350, 40, 10, 16, 4, 50, 21, 415, 20, 5).designCapacity;
const deepCapacity = api.beamFlexuralResponse(250, 500, 40, 10, 16, 4, 50, 21, 415, 20, 5).designCapacity;
assert(deepCapacity > shallowCapacity);

const supplied = [
  {name: "B3-2-AB", width: 200, height: 325, moment: 66.18, count: 4},
  {name: "B3-2-BC", width: 200, height: 325, moment: 58.81, count: 4},
  {name: "B3-2-CD", width: 200, height: 300, moment: 49.18, count: 4},
  {name: "TB1-2-AB", width: 200, height: 300, moment: 39.85, count: 3},
  {name: "TB1-2-CD", width: 200, height: 300, moment: 28.49, count: 2}
];

supplied.forEach(beam => {
  const actual = api.beamFlexuralResponse(beam.width, beam.height, 40, 10, 16, beam.count, beam.moment, 21, 415, 20, 5);
  const reference = referenceFlexure({...beam, cover: 40, stirrup: 10, diameter: 16, fc: 21, fy: 415});
  assert(Math.abs(actual.effectiveDepth - reference.d) < 1e-9, `${beam.name}: effective depth differs from independent calculation`);
  assert(Math.abs(actual.phi - reference.phi) < 1e-9, `${beam.name}: phi differs from independent calculation`);
  assert(Math.abs(actual.demandRatio - reference.ratio) < 1e-9, `${beam.name}: D/C differs from independent calculation`);
});

if (process.env.BEAM_AUDIT_REPORT === "1") {
  console.table(supplied.map(beam => {
    const result = api.beamFlexuralResponse(beam.width, beam.height, 40, 10, 16, beam.count, beam.moment, 21, 415, 20, 5);
    return {
      beam: beam.name,
      layers: result.layerCounts.join("+"),
      d_mm: result.effectiveDepth.toFixed(2),
      clear_mm: Number.isFinite(result.actualHorizontalClearSpacing) ? result.actualHorizontalClearSpacing.toFixed(2) : "N/A",
      phi: result.phi.toFixed(3),
      capacity_kNm: result.designCapacity.toFixed(2),
      corrected_DC: result.demandRatio.toFixed(3),
      preliminary_result: result.pass ? "PASS" : result.fitFailure || "FAIL"
    };
  }));
}

assert(html.includes("Project-specific torsion, development/anchorage, splice and beam-column joint checks remain INCOMPLETE / NOT VERIFIED"), "Unimplemented mandatory beam checks must be disclosed instead of silently passed");
assert(html.includes('id="beamFrameClassification"'), "Beam frame classification must be an explicit project input");
assert(html.includes('id="beamMaximumAggregateSize"'), "Maximum aggregate size must be an explicit bar-fit input");
assert(html.includes('id="beamRebarPlacementTolerance"'), "Rebar placement tolerance must be an explicit bar-fit input");

console.log("beam engine audit regression tests: passed (15 scenarios + 5 supplied beams)");
