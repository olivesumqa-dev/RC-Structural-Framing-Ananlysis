const { request } = require("./supabase");

const FEATURE = "FULL_RC_STRUCTURAL_DESIGNER";
const PLAN = {
  PROFESSIONAL_MONTHLY: { amount: 1290, interval: "MONTH", label: "Professional Monthly" },
  PROFESSIONAL_ANNUAL: { amount: 11900, interval: "YEAR", label: "Professional Annual" }
};
const PRODUCTION_CAPABILITIES = {
  useDesigner: true, editModel: true, runAnalysis: true, runBeamDesign: true, runColumnDesign: true,
  runSlabDesign: true, runFootingDesign: true, runWindAnalysis: true, runSeismicAnalysis: true,
  viewResults: true, viewDrawings: true, changeInputs: true, rerunDesign: true,
  saveLocalProject: true, saveCloudProject: true, print: true, printPDF: true, pdfExport: true,
  excelExport: true, csvExport: true, cadExport: true, downloadProject: true, downloadReport: true, allProductionExports: true
};
function capabilities(state) {
  const paid = state === "SUBSCRIPTION_ACTIVE" || state === "ADMIN_GRANTED";
  const usable = paid || state === "TRIAL_ACTIVE" || state === "TRIAL_CANCELLED_PENDING_EXPIRY";
  return { ...PRODUCTION_CAPABILITIES,
    useDesigner: usable, editModel: usable, runAnalysis: usable, runBeamDesign: usable, runColumnDesign: usable,
    runSlabDesign: usable, runFootingDesign: usable, runWindAnalysis: usable, runSeismicAnalysis: usable,
    viewResults: usable, viewDrawings: usable, changeInputs: usable, rerunDesign: usable,
    saveLocalProject: paid, saveCloudProject: paid, print: paid, printPDF: paid, pdfExport: paid,
    excelExport: paid, csvExport: paid, cadExport: paid, downloadProject: paid, downloadReport: paid, allProductionExports: paid
  };
}

function isMissingPremiumSchema(error) {
  const message = String(error?.message || error || "");
  return /Could not find the table ['\"]public\.(feature_entitlements|billing_payment_methods)['\"] in the schema cache/i.test(message);
}

function developmentTrialEnabled() {
  return String(process.env.STRUC_FORGE_DEVELOPMENT_TRIAL || "").trim().toLowerCase() === "true";
}

function developmentTrialEntitlement() {
  return {
    state: "TRIAL_ACTIVE",
    feature: FEATURE,
    startsAt: null,
    // This is deliberately a development-only access path. It is not a paid
    // entitlement and it remains unavailable unless the server flag is set.
    expiresAt: "2099-12-31T23:59:59.999Z",
    selectedPlan: "PROFESSIONAL_MONTHLY",
    cancelAtTrialEnd: false,
    paymentMethodVerified: false,
    developmentFallback: true,
    capabilities: capabilities("TRIAL_ACTIVE")
  };
}

async function entitlementFor(userId) {
  try {
    const rows = await request(`/rest/v1/feature_entitlements?user_id=eq.${encodeURIComponent(userId)}&feature=eq.${FEATURE}&select=*`);
    let record = rows[0];
    if (!record) {
      const created = await request("/rest/v1/feature_entitlements", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ user_id: userId, feature: FEATURE }) });
      record = created[0];
    }
    const now = Date.now();
    if ((record.state === "TRIAL_ACTIVE" || record.state === "TRIAL_CANCELLED_PENDING_EXPIRY") && record.expires_at && Date.parse(record.expires_at) <= now) {
      const nextState = record.cancel_at_trial_end ? "EXPIRED" : "PAYMENT_PENDING";
      const updated = await request(`/rest/v1/feature_entitlements?id=eq.${record.id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ state: nextState, updated_at: new Date().toISOString() }) });
      record = updated[0];
    }
    const paymentMethods = await request(`/rest/v1/billing_payment_methods?user_id=eq.${encodeURIComponent(userId)}&status=eq.VERIFIED&select=id&limit=1`);
    return { state: record.state, feature: FEATURE, startsAt: record.starts_at, expiresAt: record.expires_at,
      selectedPlan: record.selected_plan, cancelAtTrialEnd: record.cancel_at_trial_end, paymentMethodVerified: Boolean(paymentMethods[0]), capabilities: capabilities(record.state) };
  } catch (error) {
    if (developmentTrialEnabled() && isMissingPremiumSchema(error)) return developmentTrialEntitlement();
    throw error;
  }
}
module.exports = { FEATURE, PLAN, capabilities, entitlementFor, developmentTrialEnabled, isMissingPremiumSchema };
