const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert(html.includes("@media (max-width: 1800px)"), "Compressed desktop windows must keep the fixed-column MPR layout");
assert(html.includes("contain: layout paint") && html.includes("scrollbar-gutter: stable"), "Scrollable MPR tables must isolate layout and reserve scrollbar space");
assert(html.includes('canvas.addEventListener("pointerdown"') && html.includes('canvas.addEventListener("pointermove"'), "Plan and Y-frame gestures must use unified pointer events");
assert(html.includes('xCanvas.addEventListener("pointermove"') && html.includes('event.pointerType === "mouse"'), "X-frame must provide a dedicated touch/pen gesture path without duplicating mouse work");
assert(html.includes('window.matchMedia?.("(pointer: coarse)")?.matches) return;'), "Coarse-pointer MPR tables must avoid per-column resize listeners");
assert(app.includes("lastPanDrawAt") && app.includes("32 - (performance.now() - lastPanDrawAt)"), "Legacy X-frame redraws must be capped near 30 fps on touch devices");
assert(/canvas\.addEventListener\("wheel",[\s\S]*?queuePanDraw\(\);[\s\S]*?passive:false/.test(app), "Wheel zoom should use the coalesced X-frame renderer");

console.log("Responsive interaction performance regression tests: passed");
