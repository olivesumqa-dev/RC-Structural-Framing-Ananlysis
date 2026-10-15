const { requireUser, request } = require("../_lib/supabase");
const { FEATURE, PLAN, entitlementFor } = require("../_lib/entitlements");

const STATES = new Set(["TRIAL_ELIGIBLE", "TRIAL_PAYMENT_REQUIRED", "TRIAL_ACTIVE", "TRIAL_CANCELLED_PENDING_EXPIRY", "SUBSCRIPTION_ACTIVE", "PAYMENT_PENDING", "PAYMENT_FAILED", "EXPIRED", "ADMIN_GRANTED"]);
function permitted(user, req) {
  const localDevelopment = process.env.VERCEL_ENV !== "production" && process.env.NODE_ENV !== "production";
  const supplied = req.headers["x-strucforge-admin-test-key"];
  const configured = process.env.STRUC_FORGE_ADMIN_TEST_KEY;
  const admin = user.app_metadata?.strucforge_admin === true;
  return localDevelopment || Boolean(admin && configured && supplied === configured);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const user = await requireUser(req);
    if (!permitted(user, req)) return res.status(403).json({ error: "Administrative development access is required." });
    await entitlementFor(user.id);
    const state = req.body?.state;
    if (!STATES.has(state)) return res.status(400).json({ error: "Unsupported entitlement state." });
    const remaining = { "7_days": 7 * 86400000, "1_day": 86400000, "1_hour": 3600000, expired: -1000 }[req.body?.remaining] ?? null;
    const now = new Date();
    const trialLike = state === "TRIAL_ACTIVE" || state === "TRIAL_CANCELLED_PENDING_EXPIRY";
    const payload = {
      state, selected_plan: req.body?.selectedPlan && PLAN[req.body.selectedPlan] ? req.body.selectedPlan : "PROFESSIONAL_MONTHLY",
      starts_at: trialLike ? now.toISOString() : null,
      expires_at: trialLike ? new Date(now.getTime() + (remaining ?? 7 * 86400000)).toISOString() : null,
      cancel_at_trial_end: state === "TRIAL_CANCELLED_PENDING_EXPIRY", updated_at: now.toISOString()
    };
    await request(`/rest/v1/feature_entitlements?user_id=eq.${encodeURIComponent(user.id)}&feature=eq.${FEATURE}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload) });
    return res.status(200).json(await entitlementFor(user.id));
  } catch (error) { return res.status(error.statusCode || 500).json({ error: error.message }); }
};
