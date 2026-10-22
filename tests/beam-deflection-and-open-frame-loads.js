const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(html, /<th>Max Def\., mm<\/th>/, "Beam MPR must expose maximum deflection in millimetres");
assert.match(html, /displayedDeflection[\s\S]{0,500}serviceDeflection/, "Beam rows must derive maximum deflection from the serviceability calculation");
assert.match(html, /Maximum conservative service-load deflection/, "Deflection cells must identify the reported result");
assert.match(html, /function displayedBeamLoads\(/, "Frame views must share the no-slab beam load display helper");
assert.match(html, /case:\s*"DL-SW"[\s\S]{0,500}case:\s*"LL"[\s\S]{0,180}w:\s*0/, "No-slab beams must display self-weight DL and an explicit zero LL");
assert.match(html, /displayedBeamLoads\(member, rawMemberLoads\)/, "Y-axis frames must use the no-slab load display helper");
assert.match(html, /displayedBeamLoads\(member, memberLoads\)/, "X-axis frames must use the no-slab load display helper");
assert.match(html, /app\.js\?v=83/, "The X-frame grid-circle update must bypass cached drawing code");

const gridBubble = app.match(/function drawGridBubbles\(\) \{[\s\S]*?\n\}/)?.[0] || "";
assert(gridBubble, "X-axis grid bubble renderer must exist");
assert.doesNotMatch(gridBubble, /ctx\.fill\(\)/, "X-axis grid circles must remain transparent");
assert.match(gridBubble, /ctx\.stroke\(\)/, "X-axis grid circles must keep their outline");

console.log("Beam deflection, no-slab frame loads, and open grid-circle checks passed.");
