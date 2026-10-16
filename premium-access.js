(() => {
  "use strict";
  const FEATURE = "FULL_RC_STRUCTURAL_DESIGNER";
  const blocked = () => false;
  let entitlement = { state: "LOADING", feature: FEATURE, capabilities: {} };
  let selectedPlan = "PROFESSIONAL_MONTHLY";
  let workspaceDirty = false;
  const gate = document.querySelector("#sf-premium-gate");
  const panel = document.querySelector("#sf-premium-panel");
  const banner = document.querySelector("#sf-trial-banner");

  function can(capability) { return entitlement.capabilities?.[capability] === true; }
  function formatDate(value) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "—"; }
  function daysLeft(value) { return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)); }
  function apiMessage(error) { return error?.error || "We could not update Premium access. Please try again."; }
  async function token() {
    const client = window.supabase?.createClient("https://kilbwfmoqtwxjemdfkdo.supabase.co", "sb_publishable__5nA7rI5o0NElzVwq8ZAXw_wqlhcfGs", { auth: { persistSession: true, autoRefreshToken: true, storageKey: "strucforge-rc-designer-auth" } });
    const { data } = await client.auth.getSession();
    return data.session?.access_token || "";
  }
  async function request(path, body) {
    const accessToken = await token();
    const response = await fetch(path, { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${accessToken}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw data;
    return data;
  }
  function setRestrictedButtons() {
    const map = {
      saveLocalProject: ["#saveBtn", "#saveAsBtn", "#toolbarSaveBtn", "#toolbarSaveAsBtn", "#toolbarSaveTemplateBtn", "#saveTemplateConfirm", "#toolbarExportBtn", "#exportJson", "#columnShapeSave", "#columnShapeDelete"],
      excelExport: ["#mprExcelBtn"],
      print: ["button[id$='PrintBtn']", "#printLocalBtn", "#toolbarPrintBtn"],
      printPDF: ["button[id*='PrintPdf']", "#printPdfBtn", "#toolbarPrintPdfBtn"]
    };
    Object.entries(map).forEach(([capability, selectors]) => document.querySelectorAll(selectors.join(",")).forEach(button => {
      const disabled = !can(capability);
      button.disabled = disabled;
      button.toggleAttribute("aria-disabled", disabled);
      if (disabled) button.title = "Available with an active StrucForge Professional plan.";
    }));
  }
  function showGate(html) { document.body.classList.add("sf-premium-pending"); gate.hidden = false; panel.innerHTML = html; }
  function hideGate() { gate.hidden = true; document.body.classList.remove("sf-premium-pending"); }
  function planName() { return selectedPlan === "PROFESSIONAL_ANNUAL" ? "Professional Annual" : "Professional Monthly"; }
  function planPrice() { return selectedPlan === "PROFESSIONAL_ANNUAL" ? "₱11,900/year" : "₱1,290/month"; }
  function render() {
    setRestrictedButtons();
    const trial = entitlement.state === "TRIAL_ACTIVE" || entitlement.state === "TRIAL_CANCELLED_PENDING_EXPIRY";
    banner.hidden = !trial;
    if (trial) {
      banner.innerHTML = `<strong>PREMIUM TRIAL • ${daysLeft(entitlement.expiresAt)} days remaining</strong><span>All design and analysis features are available. Saving, printing, PDF, Excel and exports are disabled.</span><button data-premium-manage>Manage Trial</button>`;
      hideGate();
      return;
    }
    if (entitlement.state === "SUBSCRIPTION_ACTIVE" || entitlement.state === "ADMIN_GRANTED") return hideGate();
    if (entitlement.state === "TRIAL_ELIGIBLE") return showGate(`<p class="sf-premium-eyebrow">StrucForge Premium</p><h1>Full R.C. Structural Designer</h1><p>Try all structural design and analysis features free for 7 days.</p><ul><li>All design and analysis features are available</li><li>Saving, printing, PDF, Excel and all file exports are disabled</li></ul><p>A payment method is required to begin the trial. You will not be charged today.</p><button class="sf-premium-primary" data-premium-start>Start 7-Day Free Trial</button><button class="sf-premium-secondary" data-premium-plans>View Plans</button>`);
    if (entitlement.state === "TRIAL_PAYMENT_REQUIRED") {
      if (entitlement.paymentMethodVerified) showGate(`<p class="sf-premium-eyebrow">Payment method verified</p><h1>Start your 7-day free trial</h1><p>Selected plan: <strong>${planName()}</strong><br>Price after trial: <strong>${planPrice()}</strong><br>Today: <strong>₱0</strong></p><p>Trial begins today and ends ${formatDate(new Date(Date.now() + 7 * 86400000))}. Cancel before the trial ends and you will not be charged.</p><p>During the trial, design and analysis are available; saving, printing and exports are disabled.</p><button class="sf-premium-primary" data-premium-confirm>Start Free Trial</button><button class="sf-premium-secondary" data-premium-plans>Change plan</button>`);
      else showGate(`<p class="sf-premium-eyebrow">One more step</p><h1>Add a payment method</h1><p>Your selected plan is <strong>${planName()}</strong>. A valid payment method must be verified before the trial can begin. You will not be charged today.</p><button class="sf-premium-primary" data-premium-payment>Add payment method</button><button class="sf-premium-secondary" data-premium-plans>Change plan</button>`);
    }
    if (entitlement.state === "PAYMENT_PENDING") showGate(`<p class="sf-premium-eyebrow">Trial ended</p><h1>Activating your Professional plan</h1><p>We are confirming the first scheduled payment. Production saving, printing and exports remain locked until payment succeeds.</p>`);
    if (entitlement.state === "PAYMENT_FAILED") showGate(`<p class="sf-premium-eyebrow">Payment needed</p><h1>We couldn't activate your Professional subscription.</h1><p>Your trial has ended and payment could not be completed. Update your payment method or choose another plan.</p><button class="sf-premium-primary" data-premium-plans>Choose a plan</button>`);
    if (entitlement.state === "EXPIRED") showGate(`<p class="sf-premium-eyebrow">Trial ended</p><h1>Continue with StrucForge Professional</h1><p>Your Premium trial has ended. Choose a plan to regain access to the Full R.C. Structural Designer.</p><button class="sf-premium-primary" data-premium-plans>View plans</button>`);
  }
  function planScreen() {
    showGate(`<p class="sf-premium-eyebrow">StrucForge Premium</p><h1>Choose what happens after your free trial</h1><label class="sf-plan"><input type="radio" name="sf-plan" value="PROFESSIONAL_MONTHLY" ${selectedPlan === "PROFESSIONAL_MONTHLY" ? "checked" : ""}><span><strong>Professional Monthly</strong><b>₱1,290/month</b><small>Best for regular users. Includes full Premium use, local saving, printing, PDF, Excel and supported production exports.</small></span></label><label class="sf-plan"><input type="radio" name="sf-plan" value="PROFESSIONAL_ANNUAL" ${selectedPlan === "PROFESSIONAL_ANNUAL" ? "checked" : ""}><span><strong>Professional Annual <em>BEST VALUE</em></strong><b>₱11,900/year</b><small>Equivalent to approximately ₱992/month. Same paid features as Monthly.</small></span></label><p>You can cancel before the trial ends and you will not be charged.</p><button class="sf-premium-primary" data-premium-continue>Continue</button>`);
  }
  async function refresh() {
    try { entitlement = await request("/api/entitlements/full-rc-structural-designer"); selectedPlan = entitlement.selectedPlan || selectedPlan; render(); }
    catch (error) { showGate(`<h1>Premium access is temporarily unavailable</h1><p>${apiMessage(error)}</p>`); }
  }
  async function paymentMethod() {
    showGate(`<p class="sf-premium-eyebrow">Secure payment verification</p><h1>Preparing your payment method</h1><p>Please wait while we open the secure payment form. You will not be charged today.</p>`);
    try {
      const result = await request("/api/billing/create-payment-method-session", { selectedPlan });
      if (!result.componentsSdkKey) throw { error: "The payment provider did not return a secure payment-method session." };
      showGate(`<p class="sf-premium-eyebrow">Secure payment verification</p><h1>Complete payment-method verification</h1><p>Complete the secure Xendit form, then return here. The trial stays locked until the signed payment-provider webhook verifies the method.</p><button class="sf-premium-primary" data-premium-refresh>I've completed verification</button>`);
      // The Xendit Components SDK is intentionally loaded only after merchant
      // credentials and approved origins have been configured. Never simulate success.
      window.dispatchEvent(new CustomEvent("strucforge:xendit-payment-method-session", { detail: result }));
    } catch (error) { showGate(`<p class="sf-premium-eyebrow">Payment method</p><h1>We couldn't prepare secure payment verification.</h1><p>${apiMessage(error)}</p><button class="sf-premium-secondary" data-premium-plans>Choose a plan</button>`); }
  }
  async function startTrial() { try { entitlement = await request("/api/trials/start", { selectedPlan }); render(); } catch (error) { alert(apiMessage(error)); } }
  async function cancelTrial() { if (!confirm(`Cancel the scheduled ${planName()} charge? Your trial remains available until ${formatDate(entitlement.expiresAt)}.`)) return; try { entitlement = await request("/api/trials/cancel", {}); render(); } catch (error) { alert(apiMessage(error)); } }
  document.addEventListener("click", event => {
    const control = event.target.closest("[data-premium-start],[data-premium-plans],[data-premium-continue],[data-premium-payment],[data-premium-confirm],[data-premium-manage],[data-premium-refresh]");
    if (!control) return;
    if (control.hasAttribute("data-premium-start") || control.hasAttribute("data-premium-plans")) planScreen();
    if (control.hasAttribute("data-premium-continue")) { selectedPlan = panel.querySelector("input[name='sf-plan']:checked")?.value || selectedPlan; paymentMethod(); }
    if (control.hasAttribute("data-premium-payment")) paymentMethod();
    if (control.hasAttribute("data-premium-confirm")) startTrial();
    if (control.hasAttribute("data-premium-manage")) cancelTrial();
    if (control.hasAttribute("data-premium-refresh")) refresh();
  });
  document.addEventListener("input", event => { if (event.target.closest(".app")) workspaceDirty = true; }, true);
  document.addEventListener("keydown", event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p" && !can("print")) { event.preventDefault(); alert("Printing is disabled during the StrucForge Premium trial."); } }, true);
  window.addEventListener("beforeprint", () => { if (!can("print")) document.body.classList.add("sf-trial-restricted-print"); });
  window.addEventListener("afterprint", () => document.body.classList.remove("sf-trial-restricted-print"));
  window.addEventListener("beforeunload", event => { if (workspaceDirty && (entitlement.state === "TRIAL_ACTIVE" || entitlement.state === "TRIAL_CANCELLED_PENDING_EXPIRY")) { event.preventDefault(); event.returnValue = "This trial project has not been saved and may be lost."; } });
  window.StrucForgePremium = Object.freeze({ can, require(capability, message) { if (can(capability)) return true; alert(message || "This action is available with an active StrucForge Professional plan."); return false; }, refresh, get entitlement() { return entitlement; } });
  document.addEventListener("strucforge:authenticated", refresh);
})();
