const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
vm.runInThisContext(fs.readFileSync(path.join(projectRoot, "solver.js"), "utf8"), {
  filename: "solver.js"
});

const tolerance = 0.03;
const closeTo = (actual, expected, message) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`
  );
};

const baseMember = {
  id: "B1",
  i: 1,
  j: 2,
  type: "Beam",
  E: 25000,
  A: 300 * 500,
  I: 300 * 500 ** 3 / 12,
  unitWeight: 0
};

function analyze(supports, loads, options = {selfWeightFactor: 0}) {
  return runBasicFrameAnalysis({
    nodes: [{id: 1, x: 0, y: 0}, {id: 2, x: 6, y: 0}],
    members: [{...baseMember}],
    supports,
    loads
  }, options);
}

function verifyStable(result) {
  assert.equal(result.stable, true, result.issues.join("; "));
  assert.ok(result.memberResults.B1);
}

{
  const result = analyze(
    {1: "Fixed", 2: "Fixed"},
    [{kind: "member_udl", member: "B1", case: "DL", w: 10}]
  );
  verifyStable(result);
  const member = result.memberResults.B1;
  closeTo(result.supportReactions[0].ry, 30, "fixed-fixed UDL left reaction");
  closeTo(result.supportReactions[1].ry, 30, "fixed-fixed UDL right reaction");
  closeTo(member.startMoment, -30, "fixed-fixed UDL left end moment");
  closeTo(member.endMoment, -30, "fixed-fixed UDL right end moment");
  closeTo(member.maxPositiveMoment, 15, "fixed-fixed UDL positive moment");
}

{
  const result = analyze(
    {1: "Pinned", 2: "Pinned"},
    [{kind: "member_udl", member: "B1", case: "DL", w: 10}]
  );
  verifyStable(result);
  const member = result.memberResults.B1;
  closeTo(result.supportReactions[0].ry, 30, "pinned UDL left reaction");
  closeTo(result.supportReactions[1].ry, 30, "pinned UDL right reaction");
  closeTo(member.startMoment, 0, "pinned UDL left end moment");
  closeTo(member.endMoment, 0, "pinned UDL right end moment");
  closeTo(member.maxPositiveMoment, 45, "pinned UDL midspan moment");
}

{
  const result = analyze(
    {1: "Fixed", 2: "Fixed"},
    [{kind: "member_point_vector", member: "B1", case: "LL", fx: 0, fy: -20, x: 3}]
  );
  verifyStable(result);
  const member = result.memberResults.B1;
  closeTo(result.supportReactions[0].ry, 10, "fixed-fixed point-load left reaction");
  closeTo(result.supportReactions[1].ry, 10, "fixed-fixed point-load right reaction");
  closeTo(member.startMoment, -15, "fixed-fixed point-load left end moment");
  closeTo(member.endMoment, -15, "fixed-fixed point-load right end moment");
  closeTo(member.maxPositiveMoment, 15, "fixed-fixed point-load positive moment");
}

{
  const result = analyze(
    {1: "Pinned", 2: "Pinned"},
    [
      {kind: "member_udl", member: "B1", case: "DL", w: 10},
      {kind: "member_udl", member: "B1", case: "LL", w: 5}
    ],
    {caseFactors: {DL: 1.2, LL: 1.6}, selfWeightFactor: 0}
  );
  verifyStable(result);
  closeTo(result.supportReactions[0].ry, 60, "factored-load left reaction");
  closeTo(result.supportReactions[1].ry, 60, "factored-load right reaction");
  closeTo(result.memberResults.B1.maxPositiveMoment, 90, "factored-load midspan moment");
}

{
  const column = {
    id: "C1", i: 1, j: 2, type: "Column", E: 25000,
    A: 300 * 300, I: 300 * 300 ** 3 / 12, unitWeight: 0
  };
  const result = runBasicFrameAnalysis({
    nodes: [{id: 1, x: 0, y: 0}, {id: 2, x: 0, y: 3}],
    members: [column], supports: {1: "Fixed"},
    loads: [{kind: "node", node: 2, case: "LL", fx: 10, fy: 0, mz: 0}]
  }, {caseFactors: {LL: 1}, selfWeightFactor: 0});
  assert.equal(result.stable, true, result.issues.join("; "));
  closeTo(result.supportReactions[0].rx, -10, "cantilever horizontal reaction");
  closeTo(result.supportReactions[0].mz, 30, "cantilever base moment");
  closeTo(result.nodeDisplacements.find(item => item.node === 2).dxMm, 5.333, "cantilever top displacement");
}

{
  const column = {
    id: "C1", i: 1, j: 2, type: "Column", E: 25000,
    A: 300 * 300, I: 300 * 300 ** 3 / 12, unitWeight: 0
  };
  const result = runBasicFrameAnalysis({
    nodes: [{id: 1, x: 0, y: 0}, {id: 2, x: 0, y: 3}],
    members: [column], supports: {1: "Fixed"},
    loads: [{kind: "node", node: 2, case: "LL", fx: 0, fy: -100, mz: 0}]
  }, {caseFactors: {LL: 1}, selfWeightFactor: 0});
  assert.equal(result.stable, true, result.issues.join("; "));
  closeTo(result.supportReactions[0].ry, 100, "axial column reaction");
  closeTo(result.nodeDisplacements.find(item => item.node === 2).dyMm, -0.133, "axial column shortening");
}

{
  const sharedWeightMember = {...baseMember, unitWeight: 24, selfWeightFactor: 0.5};
  const result = runBasicFrameAnalysis({
    nodes: [{id: 1, x: 0, y: 0}, {id: 2, x: 6, y: 0}],
    members: [sharedWeightMember], supports: {1: "Pinned", 2: "Pinned"}, loads: []
  }, {selfWeightFactor: 1});
  assert.equal(result.stable, true, result.issues.join("; "));
  closeTo(result.supportReactions[0].ry, 5.4, "shared self-weight left reaction");
  closeTo(result.supportReactions[1].ry, 5.4, "shared self-weight right reaction");
}

{
  const stack = selectMonotonicColumnStack([
    [{width: 300, height: 300, cost: 1}, {width: 500, height: 500, cost: 5}],
    [{width: 300, height: 300, cost: 2}, {width: 400, height: 400, cost: 1}],
    [{width: 350, height: 350, cost: 1}]
  ]);
  assert.deepEqual(stack.map(item => [item.width, item.height]), [[500, 500], [400, 400], [350, 350]]);
}

{
  const stack = selectMonotonicColumnStack([
    [{width: 400, height: 300, cost: 1}, {width: 400, height: 400, cost: 3}],
    [{width: 300, height: 400, cost: 1}, {width: 350, height: 350, cost: 2}]
  ]);
  assert.deepEqual(stack.map(item => [item.width, item.height]), [[400, 400], [350, 350]]);
}

{
  const pressure = eccentricFootingPressure({
    width: 2,
    length: 4,
    vertical: 3200,
    momentX: 640
  });
  closeTo(pressure.maximum, 520, "full-contact eccentric footing maximum pressure");
  closeTo(pressure.minimum, 280, "full-contact eccentric footing minimum pressure");
  assert.equal(pressure.contactMode, "FULL");
  assert.equal(pressure.eccentricityPass, true);
}

{
  const transient = eccentricFootingPressure({
    width: 2,
    length: 4,
    vertical: 1000,
    momentY: 500,
    shortTerm: true
  });
  closeTo(transient.maximum, 333.333, "partial-contact triangular maximum pressure");
  closeTo(transient.minimum, 0, "partial-contact minimum pressure");
  assert.equal(transient.contactMode, "PARTIAL");
  assert.equal(transient.eccentricityPass, true);

  const longTerm = eccentricFootingPressure({
    width: 2,
    length: 4,
    vertical: 1000,
    momentY: 500
  });
  assert.equal(longTerm.eccentricityPass, false);
  assert.equal(longTerm.contactMode, "UPLIFT LIMIT");
}

{
  const excessive = eccentricFootingPressure({
    width: 2,
    length: 4,
    vertical: 1000,
    momentY: 800,
    shortTerm: true
  });
  assert.equal(excessive.eccentricityPass, false);
  assert.equal(excessive.contactMode, "UPLIFT LIMIT");
}

{
  assert.deepEqual(
    generatedFrameBeamRange(7, [1, 5], true),
    {startIndex: 1, endIndex: 5},
    "ground tie beams may span only between actual supports"
  );
  assert.equal(
    generatedFrameBeamRange(7, [5, 6], true),
    null,
    "the default ground range must not create an unsupported cantilever tail"
  );
  assert.deepEqual(
    generatedFrameBeamRange(7, [5], false),
    {startIndex: 0, endIndex: 6},
    "upper-level generated framing retains its plan range"
  );
}

console.log("solver benchmarks: 13 passed");
