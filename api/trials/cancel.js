const { requireUser, request } = require("../_lib/supabase");
const { FEATURE, entitlementFor } = require("../_lib/entitlements");
const { call } = require("../_lib/xendit");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const user = await requireUser(req);
    const current = await entitlementFor(user.id);
    if (current.state !== "TRIAL_ACTIVE" && current.state !== "TRIAL_CANCELLED_PENDING_EXPIRY") {
      return res.status(409).json({ error: "There is no active trial to cancel." });
    }
    if (current.state === "TRIAL_CANCELLED_PENDING_EXPIRY") return res.status(200).json(current);
    const rows = await request(`/rest/v1/feature_entitlements?user_id=eq.${encodeURIComponent(user.id)}&feature=eq.${FEATURE}&select=id,provider_subscription_reference`);
    const entitlement = rows[0];
    if (!entitlement?.provider_subscription_reference) throw new Error("The scheduled subscription could not be located.");
    // The provider cancellation is completed first so a database flag can never
    // tell the customer a charge is cancelled when it is not.
    await call(`/recurring/plans/${encodeURIComponent(entitlement.provider_subscription_reference)}/deactivate`, { method: "POST", body: "{}" });
    const at = new Date().toISOString();
    await request(`/rest/v1/premium_trials?user_id=eq.${encodeURIComponent(user.id)}&feature=eq.${FEATURE}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "TRIAL_CANCELLED_PENDING_EXPIRY", cancel_at_trial_end: true, updated_at: at }) });
    await request(`/rest/v1/feature_entitlements?id=eq.${entitlement.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ state: "TRIAL_CANCELLED_PENDING_EXPIRY", cancel_at_trial_end: true, updated_at: at }) });
    return res.status(200).json(await entitlementFor(user.id));
  } catch (error) { return res.status(error.statusCode || 500).json({ error: error.message }); }
};
