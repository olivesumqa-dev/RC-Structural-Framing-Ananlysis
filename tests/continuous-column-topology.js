const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const blockStart = html.indexOf("function columnMemberStoryIndices(");
const blockEnd = html.indexOf("function markDeletedPlanFrameNodes(", blockStart);
assert(blockStart >= 0 && blockEnd > blockStart, "Continuous-column functions were not found in index.html");

const context = {};
vm.createContext(context);
vm.runInContext(html.slice(blockStart, blockEnd), context);

function frame(options = {}) {
  const members = [
    {id: 10, i: 1, j: 2, type: "Column", name: "C2-b2", sourcePlanColumnKey: "B|2", sourcePlanStoryIndex: 1, width: 400, height: 400, E: 25000, A: 160000, I: 2133333333},
    {id: 11, i: 2, j: 3, type: "Column", name: "C3-b2", sourcePlanColumnKey: "B|2", sourcePlanStoryIndex: 2, width: options.upperWidth || 400, height: 400, E: 25000, A: (options.upperWidth || 400) * 400, I: (options.upperWidth || 400) * Math.pow(400, 3) / 12}
  ];
  if (options.beam) members.push({id: 12, i: 2, j: 4, type: "Beam", width: 300, height: 500});
  return {
    nodes: [{id: 1, x: 0, y: 0}, {id: 2, x: 0, y: 3, hiddenPlanNode: true}, {id: 3, x: 0, y: 6}, {id: 4, x: 4, y: 3}],
    members,
    supports: options.support ? {2: "Pinned"} : {},
    loads: options.nodeLoad ? [{kind: "node", node: 2, case: "DL", fy: -10}] :
      options.memberLoad ? [{kind: "member_udl", member: 10, case: "DL", w: 2}] : [],
    selectedMemberIds: [11]
  };
}

{
  const model = frame();
  assert.strictEqual(context.mergeContinuousColumnsAcrossHiddenNodes(model), 1);
  assert.strictEqual(model.members.length, 1);
  assert.deepStrictEqual([model.members[0].i, model.members[0].j], [1, 3]);
  assert.deepStrictEqual(Array.from(model.members[0].sourcePlanStoryIndices), [1, 2]);
  assert.strictEqual(model.members[0].length, 6);
  assert.deepStrictEqual(Array.from(model.selectedMemberIds), [10]);
  assert.strictEqual(model.nodes.some(node => node.id === 2 && node.hiddenPlanNode), true);
}

for (const options of [
  {beam: true},
  {support: true},
  {nodeLoad: true},
  {memberLoad: true},
  {upperWidth: 450}
]) {
  const model = frame(options);
  assert.strictEqual(context.mergeContinuousColumnsAcrossHiddenNodes(model), 0);
  assert.strictEqual(model.members.filter(member => member.type === "Column").length, 2);
}

{
  const model = frame();
  model.nodes.find(node => node.id === 3).hiddenPlanNode = true;
  model.nodes.push({id: 5, x: 0, y: 9, hiddenPlanNode: true}, {id: 6, x: 0, y: 12});
  model.members.push(
    {id: 13, i: 3, j: 5, type: "Column", name: "C4-b2", sourcePlanColumnKey: "B|2", sourcePlanStoryIndex: 3, width: 400, height: 400, E: 25000, A: 160000, I: 2133333333},
    {id: 14, i: 5, j: 6, type: "Column", name: "C5-b2", sourcePlanColumnKey: "B|2", sourcePlanStoryIndex: 4, width: 400, height: 400, E: 25000, A: 160000, I: 2133333333}
  );
  assert.strictEqual(context.mergeContinuousColumnsAcrossHiddenNodes(model), 3);
  const run = model.members.find(member => member.type === "Column" && member.i === 1);
  assert(run);
  assert.deepStrictEqual([run.i, run.j], [1, 6]);
  assert.deepStrictEqual(Array.from(run.sourcePlanStoryIndices), [1, 2, 3, 4]);
}

{
  const physicalStart = html.indexOf("function columnPhysicalStoryRun(");
  const physicalEnd = html.indexOf("function columnRecoveredDemand(", physicalStart);
  assert(physicalStart >= 0 && physicalEnd > physicalStart, "Physical-column design helpers were not found");
  const designContext = {
    models: [],
    allKnownFrameModels() { return designContext.models; },
    levelElevations() { return [0, 3, 6, 9]; },
    makePlanData() { return {}; }
  };
  vm.createContext(designContext);
  vm.runInContext(html.slice(blockStart, blockEnd), designContext);
  vm.runInContext(html.slice(physicalStart, physicalEnd), designContext);
  const model = frame();
  designContext.mergeContinuousColumnsAcrossHiddenNodes(model);
  designContext.models = [model];
  assert.deepStrictEqual(Array.from(designContext.columnPhysicalStoryRun("B|2", 1)), [1, 2]);
  assert.strictEqual(designContext.columnPhysicalLength("B|2", 1), 6);
}

assert(
  html.includes("columnMemberStoryIndices(member).some(storyIndex => storyRun.includes(storyIndex))"),
  "A merged column rename is not synchronized across its full physical story run"
);
assert(
  html.includes("storyRun.map(storyIndex => columnOverrideKey(parsed.key, storyIndex))"),
  "A merged column design edit is not synchronized across its full physical story run"
);

console.log("continuous-column topology regression tests: 11 passed");
