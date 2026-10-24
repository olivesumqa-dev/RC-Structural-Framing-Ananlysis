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
  ["wall-footing AUTO-PASS control", /\["wallFootingResultsSection", "Wall Footings", "wallFootings"\]/],
  ["wall-footing AUTO-PASS recomputes design", /function optimizeWallFootingDesigns[\s\S]*?wallFootingDesign[\s\S]*?footing\.autoPassVerified/],
  ["slab AUTO-PASS searches thickness", /function optimizeSlabDesigns[\s\S]*?maximumTrialThickness[\s\S]*?checked\.strengthPass/],
  ["slab AUTO-PASS searches standard bars", /candidateDiameters = autoDesign[\s\S]*?MPR_SLAB_FOOTING_BAR_DIAMETERS/],
  ["beam editing preserves AUTO-PASS", /function setCoordinatedBeamDimension[\s\S]*?scheduleMprAutoPassCalculation\("beams"\)/],
  ["extended convergence loop", /for \(let iteration = 0; iteration < 50; iteration \+= 1\)/],
  ["WF MPR table", /id="wallFootingResultsSection"[\s\S]*?id="wallFootingResultsTable"[\s\S]*?id="wallFootingResultsBody"/],
  ["WF design result rows", /function wallFootingResultRows[\s\S]*?transverseBarCount[\s\S]*?longitudinalBarCount[\s\S]*?REVISE WF DESIGN/],
  ["WF table before estimates", /id="wallFootingResultsSection"[\s\S]*?id="structuralEstimatesSection"/],
  ["WF separate estimate category", /wallFootings:\s*\{label:\s*"WALL FOOTINGS"[\s\S]*?structuralEstimateLevelBucket\(estimates\.wallFootings, "FOUNDATION"\)/],
  ["WF included in overall estimate", /structuralCategoryKeys\s*=\s*\["beams", "columns", "slabs", "footings", "wallFootings"\]/],
  ["WF print controls", /wallFootingResultsPrintBtn[\s\S]*?wallFootingResultsPrintPdfBtn/],
  ["wall estimate category", /walls:\s*\{label:\s*"WALLS"[\s\S]*?function wallEstimateTableMarkup/],
  ["wall exterior perimeter classification", /function wallIsOnExteriorFootprint[\s\S]*?bothNear\(startX, endX, totalX\)[\s\S]*?bothNear\(startY, endY, totalY\)/],
  ["wall openings deducted", /const openingArea = Math\.min\(grossArea[\s\S]*?const netArea = Math\.max\(0, grossArea - openingArea\)/],
  ["CHB sizes and allowance", /4&quot; interior CHB[\s\S]*?6&quot; exterior CHB[\s\S]*?5% allowance at 12\.5 blocks per square metre/],
  ["walls table before wall footings estimate", /wallEstimateTableMarkup\(estimates\.walls\) \+ structuralEstimateTableMarkup\(estimates\.wallFootings\)/],
  ["wall reinforcement spacing", /chbRebarDiameter:\s*10[\s\S]*?chbRebarSpacing:\s*0\.60[\s\S]*?verticalBarCount[\s\S]*?horizontalBarCount/],
  ["wall reinforcement table columns", /D10 vertical wall rebar[\s\S]*?D10 horizontal wall rebar[\s\S]*?0\.60 m/],
  ["wall materials in standard overall rows", /categoryKeys\s*=\s*\["beams", "columns", "slabs", "footings", "walls", "wallFootings"\][\s\S]*?wallMaterialKeys\s*=\s*new Set\(\["chb4", "chb6", "D10", "cement", "sand"\]\)[\s\S]*?if \(key === "D10"\)[\s\S]*?if \(key === "cement"\)[\s\S]*?if \(key === "sand"\)/],
  ["wall mortar and finish factors", /chbLayingMortarWetVolumePerSquareMeter:\s*0\.012[\s\S]*?chbFinishThicknessPerFace:\s*0\.012[\s\S]*?mortarCementPart:\s*1[\s\S]*?mortarSandParts:\s*3/],
  ["wall mortar and finish quantities", /const layingMortarVolume[\s\S]*?const finishMortarVolume[\s\S]*?mortarFinishCementBags[\s\S]*?mortarFinishSand/],
  ["wall mortar and finish table columns", /CHB laying mortar[\s\S]*?Cement finish, 2 faces[\s\S]*?Mortar \+ finish cement[\s\S]*?Mortar \+ finish sand/],
  ["wall materials do not create duplicate overall rows", /const allRows = \[[\s\S]*?\['6" CHB — exterior walls', "pcs", "chb6"\][\s\S]*?\];[\s\S]*?const wallOnlyKeys = new Set\(\["chb4", "chb6"\]\)/]
];

const failures = checks.filter(([, expression]) => !expression.test(source)).map(([label]) => label);
if (failures.length) {
  console.error(`Regression checks failed: ${failures.join(", ")}`);
  process.exit(1);
}

console.log(`Passed ${checks.length} slab, AUTO-PASS, and wall-footing regression checks.`);
