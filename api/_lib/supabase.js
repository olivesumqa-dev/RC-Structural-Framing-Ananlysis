const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function required(value, name) {
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function request(path, options = {}) {
  const response = await fetch(`${required(SUPABASE_URL, "SUPABASE_URL")}${path}`, {
    ...options,
    headers: {
      apikey: required(SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) {
    let detail = "";
    try { detail = JSON.parse(text).message || ""; } catch { /* Keep the status-only error. */ }
    throw new Error(`Supabase request failed (${response.status})${detail ? `: ${detail}` : "."}`);
  }
  return text ? JSON.parse(text) : null;
}

async function requireUser(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    const error = new Error("Authentication is required.");
    error.statusCode = 401;
    throw error;
  }
  const response = await fetch(`${required(SUPABASE_URL, "SUPABASE_URL")}/auth/v1/user`, {
    headers: { apikey: required(SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"), authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const error = new Error("Your session could not be verified.");
    error.statusCode = 401;
    throw error;
  }
  return response.json();
}

module.exports = { request, requireUser };
