"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert(
  html.includes('const fallback = {beams: false, columns: false, slabs: false, footings: false, wallFootings: false}'),
  "Every structural-member AUTO-PASS scope must be opt-in"
);
assert.match(
  html,
  /function mprVerifiedPassStatus[\s\S]*?AUTO-PASS VERIFIED/,
  "Verified status must be issued through one scoped gate"
);
for (const key of ["beams", "columns", "slabs", "footings", "wallFootings"]) {
  assert(html.includes(`mprVerifiedPassStatus("${key}"`), `${key} must use the verified AUTO-PASS status gate`);
}
assert.match(
  html,
  /function bestColumnCandidateForSection[\s\S]*?MPR_COLUMN_BEAM_BAR_DIAMETERS[\s\S]*?MPR_TIE_STIRRUP_BAR_DIAMETERS/,
  "Column AUTO-PASS must search permitted longitudinal bars and ties"
);
assert.match(
  html,
  /function optimizeSlabDesigns[\s\S]*?override\.thickness = thickness[\s\S]*?checked\.strengthPass/,
  "Slab AUTO-PASS must increase thickness until the modeled strength gates pass"
);
assert.match(
  html,
  /function optimizeWallFootingDesigns[\s\S]*?wallFootingDesign[\s\S]*?footing\.design = deepCopy\(design\)/,
  "Wall-footing AUTO-PASS must recompute and retain the converged design"
);
assert.match(
  html,
  /lastAutoPassVerification = \{[\s\S]*?beamPass:[\s\S]*?columnPass:[\s\S]*?slabPass:[\s\S]*?footingPass:[\s\S]*?wallFootingPass:/,
  "The final verification gate must record every structural-member family"
);
assert.match(
  html,
  /const designGatePass = beamDesignPass && columnDesignPass && foundationComplete && slabDesignPass && wallFootingDesignPass/,
  "Overall AUTO-PASS must not omit any structural-member family"
);
assert(html.includes("AUTO-PASS stopped without a false PASS"), "An unresolved member must stop without a false PASS");

console.log("all-member convergent AUTO-PASS verification checks: passed");
