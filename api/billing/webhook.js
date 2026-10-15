const crypto = require("crypto");
const { request } = require("../_lib/supabase");
const { FEATURE } = require("../_lib/entitlements");

function validToken(value) {
  const expected = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!expected || !value) return false;
  const received = Buffer.from(String(value));
  const secret = Buffer.from(expected);
  return received.length === secret.length && crypto.timingSafeEqual(received, secret);
}

function eventId(body) {
  const identifier = body.id || body.data?.payment_session_id || body.data?.id || body.data?.recurring_plan_id || "event";
  return crypto.createHash("sha256").update(`${body.event || "unknown"}:${identifier}:${body.created || ""}`).digest("hex");
}

async function record(body) {
  const id = eventId(body);
  const existing = await request(`/rest/v1/billing_webhook_events?provider_event_id=eq.${id}&select=provider_event_id`);
  if (existing.length) return false;
  await request("/rest/v1/billing_webhook_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ provider_event_id: id, provider: "xendit", event_type: body.event || "unknown", payload: body }) });
  return id;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  if (!validToken(req.headers["x-callback-token"])) return res.status(401).json({ error: "Invalid webhook signature." });
  try {
    const body = req.body || {};
    const recorded = await record(body);
    if (!recorded) return res.status(200).json({ received: true, duplicate: true });
    const data = body.data || {};
    if (body.event === "payment_session.completed" && data.reference_id?.startsWith("sf-save-")) {
      const sessions = await request(`/rest/v1/billing_checkout_sessions?provider_reference=eq.${encodeURIComponent(data.reference_id)}&select=*`);
      const session = sessions[0];
      if (!session || !data.payment_token_id || !data.customer_id) throw new Error("Payment-method webhook cannot be matched to a checkout session.");
      await request("/rest/v1/billing_payment_methods?on_conflict=provider_payment_token_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({
        user_id: session.user_id, provider: "xendit", provider_payment_token_id: data.payment_token_id,
        provider_customer_id: data.customer_id, status: "VERIFIED", verified_at: new Date().toISOString()
      }) });
      await request(`/rest/v1/billing_checkout_sessions?id=eq.${session.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "COMPLETED", completed_at: new Date().toISOString() }) });
    }
    if (body.event === "recurring.cycle.succeeded" && data.recurring_plan_id) {
      await request(`/rest/v1/feature_entitlements?feature=eq.${FEATURE}&provider_subscription_reference=eq.${encodeURIComponent(data.recurring_plan_id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ state: "SUBSCRIPTION_ACTIVE", updated_at: new Date().toISOString() }) });
    }
    if (["recurring.cycle.failed", "recurring.cycle.force_attempt_failed"].includes(body.event) && data.recurring_plan_id) {
      await request(`/rest/v1/feature_entitlements?feature=eq.${FEATURE}&provider_subscription_reference=eq.${encodeURIComponent(data.recurring_plan_id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ state: "PAYMENT_FAILED", updated_at: new Date().toISOString() }) });
    }
    await request(`/rest/v1/billing_webhook_events?provider_event_id=eq.${recorded}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ processed_at: new Date().toISOString() }) });
    return res.status(200).json({ received: true });
  } catch (error) { return res.status(500).json({ error: "Webhook processing failed." }); }
};
