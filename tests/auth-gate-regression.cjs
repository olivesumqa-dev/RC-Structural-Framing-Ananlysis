const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const gate = fs.readFileSync(path.join(root, "auth-gate.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "SUPABASE", "migrations", "20261013_tool_access_events.sql"), "utf8");

assert.doesNotMatch(html, /class="sf-auth-pending"/, "Development access must not hide the app behind authentication.");
assert.match(html, /id="sf-auth-gate"[^>]*hidden[^>]*aria-hidden="true"/, "The retained sign-in gate must remain dormant during development.");
assert.doesNotMatch(html, /<script src="auth-gate\.js/, "Development access must not initialize the authentication gate.");
assert.match(html, /id="strucforgeDevelopmentAccess"/, "Development access must install the free-access capability shim.");
assert.match(gate, /supabase\.auth\.getUser\(\)/, "A cached browser session must be verified with Supabase.");
assert.match(gate, /strucforge:request-auth-session/, "The embedded app must request a session only from its trusted parent.");
assert.match(gate, /event\.origin !== PARENT_ORIGIN \|\| event\.source !== window\.parent/, "The embedded app must verify the parent message origin and source.");
assert.match(gate, /tool_access_events/, "An authenticated RC Designer open must be logged in Supabase.");
assert.match(migration, /enable row level security/, "The access-log table must enable RLS.");
assert.match(migration, /with check \(user_id = auth\.uid\(\)\)/, "Users must only insert their own access rows.");

console.log("Protected RC Designer authentication regression checks passed.");
