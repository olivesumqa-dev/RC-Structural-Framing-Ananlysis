const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");
const blockStart = html.indexOf("function addNodeLoad(");
const blockEnd = html.indexOf("function windKz(", blockStart);
assert(blockStart >= 0 && blockEnd > blockStart, "Story-load functions were not found in index.html");

const context = {};
vm.createContext(context);
vm.runInContext(html.slice(blockStart, blockEnd), context);

function frameWithIntermediateContinuityPoints() {
  return {
    nodes: [
      {id: 1, x: 0, y: 0},
      {id: 2, x: 4, y: 0},
      {id: 3, x: 0, y: 3, hiddenPlanNode: true},
      {id: 4, x: 4, y: 3, hiddenPlanNode: true},
      {id: 5, x: 0, y: 6},
      {id: 6, x: 4, y: 6}
    ],
    members: [
      {id: 1, i: 1, j: 3},
      {id: 2, i: 3, j: 5},
      {id: 3, i: 2, j: 4},
      {id: 4, i: 4, j: 6}
    ],
    loads: []
  };
}

function lateralResultants(frame) {
  const nodeById = new Map(frame.nodes.map(node => [String(node.id), node]));
  return frame.loads.reduce((sum, load) => {
    if (!context.isLateralStoryLoad(load)) return sum;
    const node = nodeById.get(String(load.node));
    sum.fx += Number(load.fx) || 0;
    sum.mz += -(Number(node?.y) || 0) * (Number(load.fx) || 0) + (Number(load.mz) || 0);
    return sum;
  }, {fx: 0, mz: 0});
}

function assertNoHiddenLateralLoads(frame) {
  const hidden = new Set(frame.nodes.filter(node => node.hiddenPlanNode).map(node => String(node.id)));
  assert.strictEqual(frame.loads.some(load => context.isLateralStoryLoad(load) && hidden.has(String(load.node))), false);
}

{
  const frame = frameWithIntermediateContinuityPoints();
  assert.strictEqual(context.applyStoryForce(frame, 3, 100, "EQL", "auto"), 100);
  assertNoHiddenLateralLoads(frame);
  assert.deepStrictEqual(lateralResultants(frame), {fx: 100, mz: -300});
  assert.strictEqual(frame.loads.filter(load => load.appliedElevation === 0).length, 2);
  assert.strictEqual(frame.loads.filter(load => load.appliedElevation === 6).length, 2);
}

{
  const frame = frameWithIntermediateContinuityPoints();
  frame.loads.push(
    {kind: "node", case: "WL", node: 3, fx: 30, fy: 0, mz: 0, source: "auto"},
    {kind: "node", case: "WL", node: 4, fx: 70, fy: 0, mz: 0, source: "auto"}
  );
  assert.strictEqual(context.redistributeHiddenStoryLoads(frame), 2);
  assertNoHiddenLateralLoads(frame);
  assert.deepStrictEqual(lateralResultants(frame), {fx: 100, mz: -300});
}

{
  const frame = frameWithIntermediateContinuityPoints();
  frame.nodes.find(node => node.id === 3).hiddenPlanNode = false;
  context.applyStoryForce(frame, 3, 80, "WL", "auto");
  assertNoHiddenLateralLoads(frame);
  assert.strictEqual(frame.loads.length, 1);
  assert.strictEqual(frame.loads[0].node, 3);
  assert.deepStrictEqual(lateralResultants(frame), {fx: 80, mz: -240});
}

{
  const frame = frameWithIntermediateContinuityPoints();
  frame.nodes = frame.nodes.filter(node => node.y < 6);
  frame.members = frame.members.filter(member => member.id === 1 || member.id === 3);
  context.applyStoryForce(frame, 3, 50, "EQL", "auto");
  assertNoHiddenLateralLoads(frame);
  assert.deepStrictEqual(lateralResultants(frame), {fx: 50, mz: -150});
}

console.log("story-load transfer regression tests: 4 passed");
