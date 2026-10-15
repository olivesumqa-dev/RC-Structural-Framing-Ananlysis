const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "entitlements.js"), "utf8");

assert.match(source, /STRUC_FORGE_DEVELOPMENT_TRIAL/, "Development access must require an explicit server flag.");
assert.match(source, /isMissingPremiumSchema/, "Fallback must only target the missing premium schema case.");
assert.match(source, /feature_entitlements\|billing_payment_methods/, "Fallback must recognise only the premium tables expected before schema setup.");
assert.match(source, /developmentFallback:\s*true/, "Fallback response must be identifiable to clients.");
assert.match(source, /capabilities\("TRIAL_ACTIVE"\)/, "Development access must retain the restricted trial capability set.");
assert.doesNotMatch(source, /if\s*\(developmentTrialEnabled\(\)\)\s*return developmentTrialEntitlement\(\);/, "The flag alone must never bypass non-schema errors.");

console.log("premium development fallback regression checks passed");
