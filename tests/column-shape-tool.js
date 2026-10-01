const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  columnShapeBoundary,
  columnShapeProperties,
  segmentsIntersect
} = require("../column-tool.js");

const rectangleNodes = [
  {id: "a", x: -200, y: -200},
  {id: "b", x: 200, y: -200},
  {id: "c", x: 200, y: 200},
  {id: "d", x: -200, y: 200}
];
const rectangleLines = [
  {id: "ab", a: "a", b: "b"},
  {id: "bc", a: "b", b: "c"},
  {id: "cd", a: "c", b: "d"},
  {id: "da", a: "d", b: "a"}
];

const rectangle = columnShapeProperties(rectangleNodes, rectangleLines);
assert.strictEqual(rectangle.valid, true, rectangle.reason);
assert.strictEqual(rectangle.area, 160000);
assert.ok(Math.abs(rectangle.centroidX) < 1e-9);
assert.ok(Math.abs(rectangle.centroidY) < 1e-9);
assert.ok(Math.abs(rectangle.ix - 2133333333.3333333) < 0.001);
assert.ok(Math.abs(rectangle.iy - 2133333333.3333333) < 0.001);

const rectangleWithInsertionGuide = columnShapeBoundary(rectangleNodes, rectangleLines.concat({id: "guide", a: "a", b: "c"}));
assert.strictEqual(rectangleWithInsertionGuide.valid, true, rectangleWithInsertionGuide.reason);
assert.deepStrictEqual(rectangleWithInsertionGuide.constructionLineIds, ["guide"]);

const openBoundary = columnShapeBoundary(rectangleNodes, rectangleLines.slice(0, 3));
assert.strictEqual(openBoundary.valid, false);

const crossedNodes = [
  {id: "a", x: 0, y: 0},
  {id: "b", x: 100, y: 100},
  {id: "c", x: 0, y: 100},
  {id: "d", x: 100, y: 0}
];
const crossedLines = [
  {id: "ab", a: "a", b: "b"},
  {id: "bc", a: "b", b: "c"},
  {id: "cd", a: "c", b: "d"},
  {id: "da", a: "d", b: "a"}
];
assert.strictEqual(columnShapeBoundary(crossedNodes, crossedLines).valid, false);
assert.strictEqual(
  segmentsIntersect(
    {x: 0, y: 0},
    {x: 100, y: 100},
    {x: 0, y: 100},
    {x: 100, y: 0}
  ),
  true
);

const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert.ok(indexSource.includes('id="columnToolBtn"'));
assert.ok(indexSource.includes('id="columnShapeCanvas"'));
assert.ok(indexSource.includes("columnShapeLibrary: deepCopy(window.StrucForgeColumnTool?.getLibrary?.() || [])"));
assert.ok(indexSource.includes("window.StrucForgeColumnTool?.mergeLibrary?.(snapshot.columnShapeLibrary || [])"));

console.log("Column shape geometry checks passed.");
