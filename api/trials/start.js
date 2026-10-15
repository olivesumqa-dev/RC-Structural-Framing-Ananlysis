const { requireUser, request } = require("../_lib/supabase");
const { FEATURE, PLAN, entitlementFor } = require("../_lib/entitlements");
const { call } = require("../_lib/xendit");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const user = await requireUser(req);
    const selectedPlan = req.body?.selectedPlan;
    if (!PLAN[selectedPlan]) return res.status(400).json({ error: "Select a supported Professional plan." });
    const current = await entitlementFor(user.id);
    if (current.state !== "TRIAL_PAYMENT_REQUIRED") return res.status(409).json({ error: "Verify a payment method before starting the trial." });
    if (current.selectedPlan !== selectedPlan) return res.status(409).json({ error: "The selected plan changed. Verify a payment method for that plan before starting the trial." });

    const priorTrials = await request(`/rest/v1/premium_trials?user_id=eq.${encodeURIComponent(user.id)}&feature=eq.${FEATURE}&select=id&limit=1`);
    if (priorTrials.length) return res.status(409).json({ error: "This account has already used its Premium trial." });

    const methods = await request(`/rest/v1/billing_payment_methods?user_id=eq.${encodeURIComponent(user.id)}&status=eq.VERIFIED&select=*&order=verified_at.desc&limit=1`);
    const method = methods[0];
    if (!method) return res.status(409).json({ error: "A verified payment method is required before the trial can begin." });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const reference = `sf-trial-${user.id}-${now.getTime()}`;
    // A saved Xendit token is used to create a plan with no immediate payment.
    const subscription = await call("/recurring/plans", { method: "POST", body: JSON.stringify({
      reference_id: reference, customer_id: method.provider_customer_id,
      currency: "PHP", amount: PLAN[selectedPlan].amount,
      payment_tokens: [{ payment_token_id: method.provider_payment_token_id, rank: 1 }],
      schedule: { interval: PLAN[selectedPlan].interval, interval_count: 1, total_recurrence: null, anchor_date: expiresAt.toISOString(), retry_interval: "DAY", retry_interval_count: 1, total_retry: 3, failed_attempt_notifications: [1, 2, 3] },
      immediate_payment: false, failed_cycle_action: "STOP", notification_channels: ["EMAIL"], locale: "en",
      description: `StrucForge ${PLAN[selectedPlan].label} after 7-day trial`, metadata: { strucforge_user_id: user.id, feature: FEATURE }
    }) });
    await request("/rest/v1/premium_trials", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
      user_id: user.id, feature: FEATURE, selected_plan: selectedPlan, payment_method_reference: method.provider_payment_token_id,
      started_at: now.toISOString(), expires_at: expiresAt.toISOString(), status: "TRIAL_ACTIVE"
    }) });
    await request(`/rest/v1/feature_entitlements?user_id=eq.${encodeURIComponent(user.id)}&feature=eq.${FEATURE}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
      state: "TRIAL_ACTIVE", selected_plan: selectedPlan, starts_at: now.toISOString(), expires_at: expiresAt.toISOString(), cancel_at_trial_end: false,
      provider_customer_reference: method.provider_customer_id, provider_subscription_reference: subscription.id || subscription.recurring_plan_id, updated_at: now.toISOString()
    }) });
    return res.status(201).json(await entitlementFor(user.id));
  } catch (error) { return res.status(error.statusCode || 500).json({ error: error.message }); }
};
