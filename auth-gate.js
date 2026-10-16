(() => {
  "use strict";

  const SUPABASE_URL = "https://kilbwfmoqtwxjemdfkdo.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable__5nA7rI5o0NElzVwq8ZAXw_wqlhcfGs";
  const TOOL_PATH = "/full-rc-structural-designer";
  const PARENT_ORIGIN = "https://www.strucforge.com";
  const EMBEDDED = window.parent !== window;
  const gate = document.querySelector("#sf-auth-gate");
  const message = document.querySelector("#sf-auth-message");
  const actions = document.querySelector("#sf-auth-actions");
  const form = document.querySelector("#sf-auth-form");
  const googleButton = document.querySelector("#sf-auth-google");
  const emailInput = document.querySelector("#sf-auth-email");
  const passwordInput = document.querySelector("#sf-auth-password");
  const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "strucforge-rc-designer-auth" }
  });
  let unlocked = false;
  let accessRecorded = false;
  let parentSessionReceived = false;

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#ffb4a6" : "#d4dfdb";
  }

  function showSignIn(error = "") {
    document.body.classList.add("sf-auth-pending");
    gate.hidden = false;
    actions.hidden = false;
    setMessage(error || "Sign in with the same StrucForge account you use on the website.", Boolean(error));
  }

  async function analyticsIdFor(user) {
    const encoded = new TextEncoder().encode(`strucforge:ga-user-id:v1:${user.id}`);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  async function recordAuthenticatedAccess(user) {
    if (accessRecorded) return;
    accessRecorded = true;
    try {
      const analyticsUserId = await analyticsIdFor(user);
      window.gtag?.("set", "user_id", analyticsUserId);
      window.gtag?.("event", "rc_designer_authenticated", {
        tool_path: TOOL_PATH,
        entry_context: EMBEDDED ? "embedded" : "direct"
      });
    } catch { /* Analytics must never block access. */ }

    const { error } = await supabase.from("tool_access_events").insert({
      tool_path: TOOL_PATH,
      entry_context: EMBEDDED ? "embedded" : "direct"
    });
    if (error) console.warn("StrucForge access logging is unavailable:", error.message);
  }

  async function unlockFor(session) {
    if (!session?.user || !session.user.email_confirmed_at) {
      showSignIn("Please confirm your email before using the R.C. Structural Designer.");
      return;
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      showSignIn("Your session could not be verified. Please sign in again.");
      return;
    }
    await recordAuthenticatedAccess(data.user);
    unlocked = true;
    gate.hidden = true;
    document.body.classList.remove("sf-auth-pending");
    document.dispatchEvent(new CustomEvent("strucforge:authenticated", { detail: { userId: data.user.id } }));
  }

  async function verifyExistingSession() {
    if (!supabase) {
      showSignIn("Authentication is unavailable. Please return to StrucForge and try again.");
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (data.session) await unlockFor(data.session);
    else if (!parentSessionReceived) showSignIn();
  }

  async function signInWithPassword(event) {
    event.preventDefault();
    setMessage("Signing you in…");
    const { error } = await supabase.auth.signInWithPassword({ email: emailInput.value.trim(), password: passwordInput.value });
    if (error) showSignIn(error.message);
  }

  async function signInWithGoogle() {
    setMessage("Opening Google sign-in…");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${window.location.pathname}` }
    });
    if (error) showSignIn(error.message);
  }

  window.addEventListener("message", async event => {
    if (event.origin !== PARENT_ORIGIN || event.source !== window.parent) return;
    if (event.data?.type === "strucforge:auth-signout") {
      await supabase.auth.signOut();
      unlocked = false;
      showSignIn("Your StrucForge session has ended. Please sign in again.");
      return;
    }
    if (event.data?.type !== "strucforge:auth-session") return;
    parentSessionReceived = true;
    if (!event.data.session) {
      showSignIn();
      return;
    }
    const { error } = await supabase.auth.setSession(event.data.session);
    if (error) showSignIn("We could not establish your secure StrucForge session. Please sign in again.");
  });

  form.addEventListener("submit", signInWithPassword);
  googleButton.addEventListener("click", signInWithGoogle);
  supabase?.auth.onAuthStateChange(async (event, session) => {
    if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") && session) await unlockFor(session);
    if (event === "SIGNED_OUT" && unlocked) {
      unlocked = false;
      showSignIn("Your StrucForge session has ended. Please sign in again.");
    }
  });

  if (EMBEDDED) window.parent.postMessage({ type: "strucforge:request-auth-session" }, PARENT_ORIGIN);
  window.setTimeout(verifyExistingSession, EMBEDDED ? 900 : 0);
})();
