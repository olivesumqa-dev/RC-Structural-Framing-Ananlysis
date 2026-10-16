const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const checks = [
  ["WF toolbar button", /id="planWallFootingToolBtn"[\s\S]*?title="WF Tool"/],
  ["WF foundation dialog", /id="wallFootingToolDialog"[\s\S]*?WF ht\. from top of Footing, m/],
  ["WF height default", /id="wfToolHeightAboveFooting"[^>]*min="0"[^>]*value="0\.60"/],
  ["WF state persistence", /planWallFootings:\s*deepCopy\(planState\.wallFootings\)/],
  ["WF design uses soil bearing", /function wallFootingDesign[\s\S]*?soilAllowableBearing/],
  ["WF bottom uses footing top", /bottomElevationStart:\s*\(Number\(supportElevations\.start\)[\s\S]*?properties\.heightAboveFooting/],
  ["WF foundation creation", /function createPlanWallFootingAt[\s\S]*?activeLevelIndex !== -1[\s\S]*?wallFootingDesign/],
  ["WF wall linkage", /supportedByWallFooting:\s*true/],
  ["WF green hidden sides", /function drawPlanWallFootings[\s\S]*?#00c853[\s\S]*?setLineDash\(\[7, 5\]\)/],
  ["WF thin white center", /function drawPlanWallFootings[\s\S]*?#ffffff[\s\S]*?lineWidth = 0\.9/],
  ["WF walls bypass floor load transfer", /function applyStructuralWallToolLoadsToFrame[\s\S]*?if \(wall\.supportedByWallFooting\) return/],
  ["slab region keys synchronize plan", /function slabRegionStateKeys[\s\S]*?slabPanelKey/],
  ["slab edit redraws plan", /data-slab-type[\s\S]*?slabRegionStateKeys\(region\)[\s\S]*?drawPlan\(makePlanData\(\)\)/],
  ["table AUTO-PASS schedules recalculation", /function scheduleMprAutoPassCalculation[\s\S]*?requestCoordinatedAnalysis\(\)/],
  ["beam editing preserves AUTO-PASS", /function setCoordinatedBeamDimension[\s\S]*?scheduleMprAutoPassCalculation\("beams"\)/],
  ["extended convergence loop", /for \(let iteration = 0; iteration < 12; iteration \+= 1\)/],
  ["WF included in estimates", /planState\.wallFootings[\s\S]*?structuralEstimateLevelBucket\(estimates\.footings, "FOUNDATION"\)/]
];

const failures = checks.filter(([, expression]) => !expression.test(source)).map(([label]) => label);
if (failures.length) {
  console.error(`Regression checks failed: ${failures.join(", ")}`);
  process.exit(1);
}

console.log(`Passed ${checks.length} slab, AUTO-PASS, and wall-footing regression checks.`);
