const XENDIT_API = "https://api.xendit.co";

function configured() {
  return Boolean(process.env.XENDIT_SECRET_KEY && process.env.APP_ORIGIN);
}

function headers() {
  if (!configured()) {
    const error = new Error("Xendit payment setup is not configured yet.");
    error.statusCode = 503;
    throw error;
  }
  return {
    authorization: `Basic ${Buffer.from(`${process.env.XENDIT_SECRET_KEY}:`).toString("base64")}`,
    "content-type": "application/json",
    "api-version": "2026-01-01"
  };
}

async function call(path, options = {}) {
  const response = await fetch(`${XENDIT_API}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || "Xendit could not process the billing request.");
    error.statusCode = response.status >= 500 ? 502 : 400;
    throw error;
  }
  return body;
}

module.exports = { configured, call };
