const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert.match(source, /if \(dx >= 1e-6 && dy >= 1e-6\) return "D";/,
  "planMemberAxis must recognize a diagonal member");
assert.match(source, /dx >= 1e-4 && dy >= 1e-4 \? "D" : null/,
  "coordinate beam creation must accept diagonal endpoints");
assert.match(source, /return createCoordinatePlanMember\(start, intersection, data\);/,
  "two non-aligned grid intersections must route to diagonal beam creation");
assert.match(source, /function planMemberAnalysisAxis\([\s\S]*?axis !== "D"[\s\S]*?Math\.abs\(points\.end\.x - points\.start\.x\)/,
  "diagonal beams must map to a stable analysis frame axis");
assert.match(source, /planAxis === "D" \? "DIAGONAL" : "OFFSET"/,
  "diagonal beams must receive a unique analysis frame line");
assert.match(source, /rotate: diagonal \? Math\.atan2\(b\.y - a\.y, b\.x - a\.x\)/,
  "diagonal beam labels must follow the beam angle");
assert.match(source, /function diagonalSlabRegions\([\s\S]*?signedArea[\s\S]*?polygon:/,
  "closed beam loops containing diagonal members must create polygonal slab regions");
assert.match(source, /const diagonalRegions = diagonalSlabRegions\(levelIndex, data\);[\s\S]*?if \(diagonalRegions\) return diagonalRegions;/,
  "slab discovery must use polygonal regions when diagonal beams are present");
assert.doesNotMatch(source, /Beam endpoints must be horizontally or vertically aligned/,
  "the former coordinate alignment rejection must be removed");
assert.doesNotMatch(source, /Plan members must follow an X or Y gridline/,
  "the former grid alignment rejection must be removed");

console.log("Diagonal Plan beam regression checks passed.");
