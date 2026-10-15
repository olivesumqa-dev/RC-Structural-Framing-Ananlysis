const { requireUser, request } = require("../_lib/supabase");
const { FEATURE, PLAN, entitlementFor } = require("../_lib/entitlements");
const { call } = require("../_lib/xendit");

function safeName(user) {
  const supplied = String(user.user_metadata?.full_name || user.user_metadata?.name || "StrucForge User");
  return supplied.replace(/[^a-zA-Z0-9 ]/g, " ").trim().slice(0, 80) || "StrucForge User";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const user = await requireUser(req);
    const selectedPlan = req.body?.selectedPlan;
    if (!PLAN[selectedPlan]) return res.status(400).json({ error: "Select a supported Professional plan." });
    const current = await entitlementFor(user.id);
    if (current.state !== "TRIAL_ELIGIBLE" && current.state !== "TRIAL_PAYMENT_REQUIRED") {
      return res.status(409).json({ error: "This account is not eligible to start another trial." });
    }

    const reference = `sf-save-${user.id}-${Date.now()}`;
    await request(`/rest/v1/feature_entitlements?user_id=eq.${encodeURIComponent(user.id)}&feature=eq.${FEATURE}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ state: "TRIAL_PAYMENT_REQUIRED", selected_plan: selectedPlan, updated_at: new Date().toISOString() })
    });
    await request("/rest/v1/billing_checkout_sessions", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: user.id, feature: FEATURE, selected_plan: selectedPlan, provider: "xendit", provider_reference: reference })
    });

    // Xendit SAVE collects a reusable payment token without charging today.
    // Components must be initialized on an approved StrucForge origin.
    const session = await call("/sessions", { method: "POST", body: JSON.stringify({
      reference_id: reference, session_type: "SAVE", mode: "COMPONENTS", amount: 0,
      currency: "PHP", country: "PH", locale: "en",
      customer: { reference_id: `sf-${user.id}`, type: "INDIVIDUAL", email: user.email, individual_detail: { given_names: safeName(user) } },
      description: `StrucForge payment method for ${PLAN[selectedPlan].label}`,
      components_configuration: { origins: [process.env.APP_ORIGIN], return_url: `${process.env.APP_ORIGIN}/?billing=payment-method-complete` }
    }) });
    await request(`/rest/v1/billing_checkout_sessions?provider_reference=eq.${encodeURIComponent(reference)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ provider_session_id: session.payment_session_id })
    });
    return res.status(200).json({ provider: "xendit", reference, sessionId: session.payment_session_id, componentsSdkKey: session.components_sdk_key, expiresAt: session.expires_at });
  } catch (error) { return res.status(error.statusCode || 500).json({ error: error.message }); }
};
