const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert(html.includes('id="mobileSidebarToggle"') && html.includes('id="structuralSidebar"'), "Android phones need an accessible off-canvas controls button and sidebar");
assert(html.includes("function installMobileSidebar()") && html.includes("installMobileSidebar();"), "The mobile sidebar interaction must be installed");
assert(css.includes("@media (min-width:701px) and (max-width:1280px)"), "Android tablet-specific layout rules are missing");
assert(css.includes("@media (max-width:700px)"), "Android phone-specific layout rules are missing");
assert(css.includes("body.mobile-sidebar-open .panel{transform:translateX(0)}"), "The phone controls drawer must open on demand");
assert(css.includes("height:100dvh") && css.includes("touch-action:manipulation") && css.includes("-webkit-overflow-scrolling:touch"), "Mobile viewport, touch, and momentum-scrolling support is incomplete");
assert(css.includes("@media (max-width:700px) and (orientation:landscape) and (max-height:520px)"), "Short Android landscape screens need a compact layout");
assert(!css.includes("@media (min-width:1281px)"), "The Android optimization must not override the desktop layout");
assert(html.includes("function isMobilePerformanceMode()") && html.includes("/Android/i.test"), "Android devices must activate the lightweight render path");
assert(html.includes('desynchronized: true') && html.includes("function mobileDrawingContext(canvas)"), "Mobile canvases should request low-latency rendering");
assert((html.match(/32 - \(performance\.now\(\) - lastInteractiveDraw\)/g) || []).length === 2, "Plan/frame and 3D gesture redraws must be capped near 30 fps on mobile only");
assert(css.includes("body.mobile-performance-mode") && css.includes("content-visibility:auto") && css.includes("contain:layout paint style"), "Android performance mode must reduce off-screen layout and paint work");

console.log("Android responsive layout regression tests: passed");
