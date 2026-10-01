"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function sourceFunction(name) {
  const match = html.match(new RegExp(`function ${name}[^\\{]*\\{[\\s\\S]*?\\n      \\}`));
  assert(match, `${name} function is missing`);
  return match[0];
}

assert(html.includes("deletedColumnStories: new Set()"), "Column story termination state is missing");
assert(html.includes("deletedColumnStories: Array.from(planState.deletedColumnStories)"), "Column story terminations are not saved");
assert(html.includes("planState.deletedColumnStories = new Set(snapshot.deletedColumnStories || [])"), "Column story terminations are not restored");

const state = {columns: new Set(["C|3"]), deletedColumnStories: new Set()};
const storyApi = Function(
  "planState",
  `${sourceFunction("planColumnStoryKey")}
   ${sourceFunction("isPlanColumnStoryDeleted")}
   ${sourceFunction("isPlanColumnStoryActive")}
   ${sourceFunction("setPlanColumnTermination")}
   ${sourceFunction("restorePlanColumnFromStory")}
   return {isPlanColumnStoryActive, setPlanColumnTermination, restorePlanColumnFromStory};`
)(state);
const fourStoreys = {levels: ["Level-1", "Level-2", "Level-3", "Level-4"]};
storyApi.setPlanColumnTermination("C|3", 3, fourStoreys);
assert.strictEqual(storyApi.isPlanColumnStoryActive("C|3", 0), true, "Foundation-to-Level-1 column was removed by an upper cut");
assert.strictEqual(storyApi.isPlanColumnStoryActive("C|3", 1), true, "Level-1-to-Level-2 column was removed by an upper cut");
assert.strictEqual(storyApi.isPlanColumnStoryActive("C|3", 2), true, "Level-2-to-Level-3 column was removed by an upper cut");
assert.strictEqual(storyApi.isPlanColumnStoryActive("C|3", 3), false, "Level-3-to-Level-4 column was not terminated");
storyApi.restorePlanColumnFromStory("C|3", 3, fourStoreys);
assert.strictEqual(storyApi.isPlanColumnStoryActive("C|3", 3), true, "Create Column cannot restore the terminated Level-3-to-Level-4 story");

const deleteMatch = html.match(/function deletePlanColumn\(column, data = makePlanData\(\), storyIndexOverride = null\) \{[\s\S]*?\n      \}/);
assert(deleteMatch, "Column deletion handler is missing");
assert(deleteMatch[0].includes("if (storyIndex === 0)"), "Full column deletion is not limited to the base story");
assert(deleteMatch[0].includes("setPlanColumnTermination(column.key, storyIndex, data)"), "Upper-story deletion does not terminate only the selected upper stack");
assert(deleteMatch[0].includes("synchronizePlanColumn(column.key, true)"), "Upper-story deletion does not preserve and resynchronize lower column stories");

const frameDeleteCalls = [];
const deleteFrameColumnStory = Function(
  "deletePlanColumn",
  "makePlanData",
  "status",
  `${sourceFunction("deleteFrameColumnStory")}
   return deleteFrameColumnStory;`
)(
  (column, data, storyIndex) => {
    frameDeleteCalls.push({column, data, storyIndex});
    return true;
  },
  () => fourStoreys,
  () => {}
);
assert.strictEqual(deleteFrameColumnStory({
  type: "Column",
  name: "CX-C4",
  sourcePlanColumnKey: "C|3",
  sourcePlanStoryIndex: 3
}, "X"), true, "A plan-derived X-frame column story was not accepted for coordinated deletion");
assert.deepStrictEqual(frameDeleteCalls[0], {
  column: {key: "C|3", xLabel: "C", yLabel: "3"},
  data: fourStoreys,
  storyIndex: 3
}, "Frame deletion did not forward the shared plan key and exact story index");
assert.strictEqual(deleteFrameColumnStory({type: "Column", name: "manual"}, "Y"), false, "A frame-only column must not be mistaken for a coordinated plan column");

const planData = {
  xLabels: ["A", "B", "C"],
  xPos: [0, 4, 8],
  yLabels: ["1", "2"],
  yPos: [0, 5],
  levels: ["Level-1", "Level-2", "Level-3", "Level-4"]
};
const xFrame = {
  nodes: [{id: 1, x: 4, y: 9}, {id: 2, x: 4, y: 12}],
  members: []
};
const yFrame = {
  nodes: [{id: 1, x: 0, y: 9}, {id: 2, x: 0, y: 12}],
  members: []
};
const frameColumnPlanIdentity = Function(
  "model",
  "yFrameState",
  "frameNode",
  "levelElevations",
  "byId",
  "activeFrameLines",
  "columnKey",
  "makePlanData",
  `${sourceFunction("frameColumnPlanIdentity")}
   return frameColumnPlanIdentity;`
)(
  xFrame,
  {model: yFrame},
  (frameModel, id) => frameModel.nodes.find(node => String(node.id) === String(id)),
  () => [0, 3, 6, 9, 12],
  id => ({value: id === "planXFrameLine" ? "2" : "B"}),
  {X: "2", Y: "B"},
  (xLabel, yLabel) => `${xLabel}|${yLabel}`,
  () => planData
);
assert.deepStrictEqual(
  frameColumnPlanIdentity({type: "Column", i: 1, j: 2}, "X", planData),
  {axis: "X", key: "B|2", xLabel: "B", yLabel: "2", storyIndices: [3]},
  "X-frame grid B Level-3-to-Level-4 column did not resolve to the shared plan story"
);
assert.deepStrictEqual(
  frameColumnPlanIdentity({type: "Column", i: 1, j: 2}, "Y", planData),
  {axis: "Y", key: "B|2", xLabel: "B", yLabel: "2", storyIndices: [3]},
  "Y-frame coordinates did not resolve to the same shared plan column story"
);
assert.strictEqual(
  frameColumnPlanIdentity({type: "Column", i: 1, j: 2}, "X", {...planData, xPos: [0, 4.1, 8]}),
  null,
  "An off-grid frame column must not be assigned a false shared plan coordinate"
);
const coordinateCreationSource = sourceFunction("coordinateFrameColumnCreation");
assert(coordinateCreationSource.includes("planState.columns.add(identity.key)"), "Frame-created columns are not inserted in the shared plan column set");
assert(coordinateCreationSource.includes("identity.storyIndices.forEach"), "Frame-created columns do not activate their exact shared stories");
assert(coordinateCreationSource.includes("synchronizePlanColumn(identity.key, true)"), "Frame-created columns are not synchronized to both drawing directions");
assert(html.includes('coordinateFrameColumnCreation(member, "Y", makePlanData())'), "Y-frame column creation is not routed to the shared plan model");
assert(app.includes('window.onStrucForgeFrameColumnCreated(m, "X")'), "X-frame column creation is not routed to the shared plan model");
assert(app.includes("window.strucForgeXColumnMode") && app.includes("Column endpoints must be vertically aligned"), "Dedicated X-frame column mode does not enforce vertical endpoints");

assert(
  html.includes('memberHit?.member?.type === "Column" && deleteFrameColumnStory(memberHit.member, "Y", data)'),
  "Y-frame column deletion is not routed through the coordinated plan model"
);
assert(
  html.includes('directMember?.type === "Column" && deleteFrameColumnStory(directMember, "X", makePlanData())'),
  "X-frame column deletion is not routed through the coordinated plan model"
);
assert(
  html.includes("linkedPlanMembers = directMember ? [directMember] : [];"),
  "X-frame node deletion can still register connected plan beams as deleted"
);
assert(
  sourceFunction("xLoadAt").includes('if (calculationDirty || (typeof loadsVisible !== "undefined" && !loadsVisible)) return null;'),
  "Hidden X-frame loads can still intercept column deletion clicks"
);
assert(
  sourceFunction("deleteYLoadAt").includes('if (calculationDirty || (typeof loadsVisible !== "undefined" && !loadsVisible)) return false;'),
  "Hidden Y-frame loads can still intercept column deletion clicks"
);
assert(
  sourceFunction("renderStructuralSequence").includes('options.resetViews === false') &&
    sourceFunction("renderStructuralSequence").includes('planState.activeView'),
  "A coordinated frame edit does not preserve the active X/Y drawing view"
);

assert(
  html.includes("if (!isFoundationPlan && !isPlanColumnStoryActive(key, activeLevelIndex)) return;"),
  "Terminated column stories are still drawn in upper plans"
);
assert(
  (html.match(/if \(!isPlanColumnStoryActive\(planKey, levelIndex\)\) continue;/g) || []).length >= 3,
  "A plan or X/Y frame generator still creates terminated column stories"
);
assert(
  html.includes("if (!isPlanColumnStoryActive(key, storyIndex)) return;") &&
    html.includes("const storyRun = columnPhysicalStoryRun(key, storyIndex);") &&
    html.includes("if (renderedRuns.has(runKey) || storyIndex !== Math.min(...storyRun)) return;"),
  "Terminated column stories are still emitted in the MPR column table"
);
assert(
  html.includes(".filter(storyIndex => isPlanColumnStoryActive(key, storyIndex))"),
  "Column optimization still sizes terminated stories"
);
assert(
  html.includes("if (!isPlanColumnStoryActive(key, levelIndex)) break;"),
  "Fallback column tributary demand still accumulates above a column termination"
);
assert(
  html.includes("restorePlanColumnFromStory(key, planState.activeLevelIndex, data)"),
  "Create Column cannot restore a terminated upper column stack"
);

console.log("column story termination regression tests: passed");
