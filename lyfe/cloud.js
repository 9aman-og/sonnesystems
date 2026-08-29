/* ============================================================
   Lyfe - cloud sync + auth (Supabase).  OPTIONAL layer.

   If supabase-config.js is empty, this module reports itself as
   "unconfigured" and the app runs local-only guest mode, exactly
   as before. Nothing here can break the offline app: every network
   path fails soft back to local.

   When configured, it adds email sign-in and per-user cloud sync. Google and
   Gmail are exposed only when the deployment explicitly enables that provider.
   Security is enforced server-side by Postgres row-level security
   (see schema.sql). The anon key is public by design.

   Public surface (window.LyfeCloud):
     .configured                      bool
     .user                            {id,email,name} | null
     await .init()  -> "cloud" | "gate" | "unconfigured"
     await .signInGoogle()
     await .signInEmail(email)
     await .verifyEmailOtp(email, token)
     await .signOut()
     await .pull()  -> {data,rev} | null
     await .push(data, rev)
     .pushDebounced(data, rev)
     .subscribe(onRemote)             onRemote({data,rev})
     await .pullConnect()             -> {data,rev} | null
     await .pushConnect(data, rev)
     .pushConnectDebounced(data, rev)
     await .invokeAero({prompt,date,kind})
     await .prepareAeroRun({requestKey,intent,actions})
     await .commitAeroRun({runId,contractDigest,approvalToken})
     await .cancelAeroRun({runId,contractDigest})
     await .inspectAeroRun(runId)
     await .forgetAeroRun({runId,contractDigest})
     await .readAeroMemory()
     await .prepareAeroMemory({requestKey,operations})
     await .commitAeroMemory({transactionId,contractDigest,approvalToken})
     await .observeAeroMemory({requestKey,operations})
     await .cancelAeroMemory({transactionId,contractDigest})
     await .inspectAeroMemory(transactionId)
     await .forgetAeroMemoryTransaction({transactionId,contractDigest})
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.LYFE_SUPABASE || {};
  var SB_URL = String(CFG.url || "").trim();
  var SB_ANON = String(CFG.anonKey || "").trim();
  var configured = /^https:\/\/.+\.supabase\.co\/?$/.test(SB_URL) && SB_ANON.length > 20;
  var googleEnabled = CFG.googleEnabled === true;
  var aeroGatewayEnabled = CFG.aeroGatewayEnabled === true;
  var aeroExecutionEnabled = CFG.aeroExecutionEnabled === true;
  var aeroMemoryEnabled = CFG.aeroMemoryEnabled === true;
  var providerSettingsChecked = false;

  // Exact pin keeps an upstream release from changing the app between deploys.
  var SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.2";
  var TABLE = "lyfe_states";
  var CONNECT_TABLE = "lyfe_connect_states";

  var sb = null;        // supabase client (created lazily)
  var current = null;   // { id, email, name }
  var googleProviderToken = ""; // memory-only: never copied into Lyfe data
  var gmailConnecting = false;
  var lastAuthError = "";
  var authListenerAttached = false;
  var pushTimer = null;
  var connectPushTimer = null;
  var confirmedRev = 0;
  var writeChain = Promise.resolve();
  var pendingWrites = 0;
  var queuedRemote = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("supabase sdk failed to load")); };
      document.head.appendChild(s);
    });
  }

  async function ensureClient() {
    if (sb) return sb;
    if (!(window.supabase && window.supabase.createClient)) {
      await loadScript(SDK_URL);
    }
    sb = window.supabase.createClient(SB_URL, SB_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    if (!authListenerAttached) {
      authListenerAttached = true;
      sb.auth.onAuthStateChange(function (event, session) {
        current = userFrom(session);
        // Supabase access-token refresh events commonly omit provider_token.
        // Keep the last Google token in memory until Google rejects it or the
        // person signs out; never copy it into Lyfe data or localStorage.
        if (session && session.provider_token) {
          googleProviderToken = String(session.provider_token);
          gmailConnecting = false;
        } else if (!session) {
          googleProviderToken = "";
          gmailConnecting = false;
        }
        if (session) {
          lastAuthError = "";
          cleanUrl();
        }
        try {
          window.dispatchEvent(new CustomEvent("lyfe:authchange", {
            detail: { event: event, user: current }
          }));
        } catch (e) { /* older browsers can continue without the event */ }
      });
    }
    return sb;
  }

  async function refreshProviderSettings() {
    if (!configured || providerSettingsChecked) return googleEnabled;
    providerSettingsChecked = true;
    try {
      var response = await fetch(SB_URL.replace(/\/$/, "") + "/auth/v1/settings", {
        headers: { apikey: SB_ANON }
      });
      if (!response.ok) return googleEnabled;
      var settings = await response.json();
      googleEnabled = !!(settings && settings.external && settings.external.google);
    } catch (e) { /* configuration fallback remains available */ }
    return googleEnabled;
  }

  function userFrom(session) {
    if (!session || !session.user) return null;
    var u = session.user;
    var meta = u.user_metadata || {};
    return {
      id: u.id,
      email: u.email || "",
      name: meta.full_name || meta.name || (u.email || "").split("@")[0] || "you"
    };
  }

  function sanitize(data) {
    // strip device-only secrets so they never leave the machine
    var clone;
    try { clone = JSON.parse(JSON.stringify(data)); } catch (e) { return data; }
    if (clone && clone.settings) clone.settings.apiKey = "";
    return clone;
  }

  function rememberConfirmed(data, rev) {
    var value = Number(rev || 0);
    if (!Number.isSafeInteger(value) || value < 0) return;
    confirmedRev = value;
  }

  function releaseQueuedRemote() {
    if (pendingWrites > 0 || pushTimer || !queuedRemote) return;
    var item = queuedRemote;
    queuedRemote = null;
    if (item.rev <= confirmedRev) return;
    rememberConfirmed(item.data, item.rev);
    try { item.onRemote({ data: item.data, rev: item.rev }); } catch (e) { /* sync remains durable */ }
  }

  function cleanUrl() {
    // After Google returns, drop callback credentials or errors from the bar.
    if (/([?&#])(code|access_token|refresh_token|error|error_code|error_description)=/.test(location.search + location.hash)) {
      try { history.replaceState(null, "", location.origin + location.pathname); } catch (e) {}
    }
  }

  function readAuthError() {
    try {
      var query = new URLSearchParams(location.search);
      var hash = new URLSearchParams(location.hash.replace(/^#/, ""));
      var message = query.get("error_description") || hash.get("error_description") ||
        query.get("error") || hash.get("error") || "";
      if (message) {
        lastAuthError = String(message).replace(/\+/g, " ").slice(0, 240);
        cleanUrl();
      }
    } catch (e) { /* malformed callback URLs fail back to the sign-in gate */ }
  }

  function cloudError(message, status, code) {
    var error = new Error(message);
    error.status = Number(status || 0);
    error.code = String(code || "cloud_error");
    return error;
  }

  async function currentAccessToken() {
    await ensureClient();
    var result = await sb.auth.getSession();
    if (result && result.error) throw result.error;
    var session = result && result.data ? result.data.session : null;
    return session && session.access_token ? session.access_token : "";
  }

  async function callAeroGateway(payload, retry) {
    var token = await currentAccessToken();
    if (!token) throw cloudError("Sign in before using the cloud-safe model.", 401, "sign_in_required");
    var response = await fetch(SB_URL.replace(/\/$/, "") + "/functions/v1/aero-groq", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        apikey: SB_ANON,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    });
    if (response.status === 401 && retry !== false) {
      var refreshed = await sb.auth.refreshSession();
      if (!(refreshed && refreshed.error)) return callAeroGateway(payload, false);
    }
    var body = {};
    try { body = await response.json(); } catch (e) { /* a shaped error follows */ }
    if (!response.ok) {
      var code = String(body && body.error || "gateway_unavailable");
      var messages = {
        sign_in_required: "Sign in before using the cloud-safe model.",
        not_allowed: "This Aero gateway is private to its approved account.",
        provider_not_configured: "The Groq route is not configured yet.",
        provider_rate_limited: "The free Groq route is busy. Try again shortly.",
        rate_limited: "Aero is sending too quickly. Try again in a minute.",
      };
      throw cloudError(messages[code] || "The cloud-safe model is unavailable.", response.status, code);
    }
    if (!(body && body.result)) throw cloudError("The cloud-safe model returned an incomplete response.", 502, "invalid_response");
    return body;
  }

  async function callAeroExecution(payload, retry) {
    var token = await currentAccessToken();
    if (!token) throw cloudError("Sign in before applying an account change.", 401, "sign_in_required");
    var response = await fetch(SB_URL.replace(/\/$/, "") + "/functions/v1/aero-execute", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        apikey: SB_ANON,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    });
    if (response.status === 401 && retry !== false) {
      var refreshed = await sb.auth.refreshSession();
      if (!(refreshed && refreshed.error)) return callAeroExecution(payload, false);
    }
    var body = {};
    try { body = await response.json(); } catch (e) { /* a shaped error follows */ }
    if (!response.ok) {
      var code = String(body && body.error || "execution_unavailable");
      var messages = {
        sign_in_required: "Sign in before applying an account change.",
        authentication_required: "Your session expired. Sign in again.",
        not_allowed: "This Aero execution route is private to its approved account.",
        execution_not_configured: "The protected Aero execution route is not configured yet.",
        state_missing: "Lyfe needs to finish its first account sync before Aero can apply this.",
        state_changed: "Lyfe changed after this plan was prepared. Review the current version again.",
        approval_expired: "This approval expired. Review the plan again.",
        approval_replayed: "That approval was already used.",
        approval_invalid: "The approval no longer matches this exact plan.",
        contract_changed: "The plan changed after review, so Aero stopped.",
        idempotency_conflict: "This request no longer matches its prepared plan.",
        run_integrity_failed: "Aero could not verify the stored run, so nothing changed.",
        journal_integrity_failed: "Aero could not verify the run journal, so nothing changed.",
        rate_limited: "Aero is sending too quickly. Try again in a minute.",
      };
      throw cloudError(messages[code] || "The protected Aero execution route is unavailable.", response.status, code);
    }
    return body;
  }

  async function callAeroMemory(payload, retry) {
    var token = await currentAccessToken();
    if (!token) throw cloudError("Sign in before using private Aero memory.", 401, "sign_in_required");
    var response = await fetch(SB_URL.replace(/\/$/, "") + "/functions/v1/aero-memory", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        apikey: SB_ANON,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    });
    if (response.status === 401 && retry !== false) {
      var refreshed = await sb.auth.refreshSession();
      if (!(refreshed && refreshed.error)) return callAeroMemory(payload, false);
    }
    var body = {};
    try { body = await response.json(); } catch (e) { /* a shaped error follows */ }
    if (!response.ok) {
      var code = String(body && body.error || "memory_unavailable");
      var messages = {
        sign_in_required: "Sign in before using private Aero memory.",
        authentication_required: "Your session expired. Sign in again.",
        not_allowed: "Private Aero memory is limited to this approved account.",
        memory_not_configured: "Private Aero memory is not configured yet.",
        memory_unavailable: "Private Aero memory is temporarily unavailable.",
        memory_state_changed: "Aero memory changed after this review. Open the plan again.",
        memory_approval_expired: "This memory approval expired. Review it again.",
        memory_approval_replayed: "That memory approval was already used.",
        memory_approval_invalid: "The approval no longer matches this exact memory change.",
        memory_contract_changed: "The memory plan changed after review, so Aero stopped.",
        memory_idempotency_conflict: "This request no longer matches its prepared memory plan.",
        memory_integrity_failed: "Aero could not verify private memory, so nothing changed.",
        memory_journal_integrity_failed: "Aero could not verify the memory journal, so nothing changed.",
        memory_not_singular: "Choose exactly one memory to forget.",
        rate_limited: "Aero is sending too quickly. Try again in a minute.",
      };
      throw cloudError(messages[code] || body.message || "Private Aero memory is unavailable.", response.status, code);
    }
    return body;
  }

  function emitCloudConflict(result) {
    if (!(result && result.data && typeof result.rev === "number")) return;
    try {
      window.dispatchEvent(new CustomEvent("lyfe:cloudconflict", {
        detail: { data: result.data, rev: result.rev }
      }));
    } catch (e) { /* the caller can still recover on its next pull */ }
  }

  var LyfeCloud = {
    configured: configured,
    get googleEnabled() { return googleEnabled; },
    get aeroGatewayEnabled() { return aeroGatewayEnabled; },
    get aeroExecutionEnabled() { return aeroExecutionEnabled; },
    get aeroMemoryEnabled() { return aeroMemoryEnabled; },
    get user() { return current; },
    get lastError() { return lastAuthError; },

    /* Resolve auth on boot. Never throws.
       "cloud"        - a session exists, caller should sync + run
       "gate"         - configured but signed out, caller shows login screen
       "unconfigured" - no backend set up (or unreachable), run guest as today */
    async init() {
      if (!configured) return "unconfigured";
      try {
        readAuthError();
        await refreshProviderSettings();
        await ensureClient();
        var res = await sb.auth.getSession();
        if (res && res.error) throw res.error;
        var session = res && res.data ? res.data.session : null;
        if (session) {
          current = userFrom(session);
          if (session.provider_token) googleProviderToken = String(session.provider_token);
          cleanUrl();
          return "cloud";
        }
        return "gate";
      } catch (e) {
        return "unconfigured"; // backend down: still open the app
      }
    },

    async signInGoogle() {
      lastAuthError = "";
      await refreshProviderSettings();
      if (!googleEnabled) throw new Error("Google sign-in is not ready on this deployment yet.");
      await ensureClient();
      var result = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: location.origin + location.pathname.replace(/index\.html$/, "") }
      });
      if (result && result.error) throw result.error;
      return result;
    },

    async connectGmail() {
      if (gmailConnecting) return null;
      lastAuthError = "";
      await refreshProviderSettings();
      if (!googleEnabled) throw new Error("Gmail connection is not ready on this deployment yet.");
      await ensureClient();
      gmailConnecting = true;
      var result = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: location.origin + location.pathname,
          scopes: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" }
        }
      });
      if (result && result.error) {
        gmailConnecting = false;
        throw result.error;
      }
      return result;
    },

    get gmailToken() { return googleProviderToken; },
    get gmailConnecting() { return gmailConnecting; },

    clearGmailToken() {
      googleProviderToken = "";
      gmailConnecting = false;
    },

    async invokeAero(payload) {
      if (!configured || !aeroGatewayEnabled) throw cloudError("The Groq route is not enabled on this deployment.", 503, "gateway_disabled");
      return callAeroGateway(payload, true);
    },

    async prepareAeroRun(payload) {
      if (!configured || !aeroExecutionEnabled) throw cloudError("The protected Aero execution route is not enabled.", 503, "execution_disabled");
      return callAeroExecution(Object.assign({ op: "prepare" }, payload || {}), true);
    },

    async commitAeroRun(payload) {
      if (!configured || !aeroExecutionEnabled) throw cloudError("The protected Aero execution route is not enabled.", 503, "execution_disabled");
      var result = await callAeroExecution(Object.assign({ op: "commit" }, payload || {}), true);
      if (result && result.state && typeof result.rev === "number") rememberConfirmed(result.state, result.rev);
      return result;
    },

    async cancelAeroRun(payload) {
      if (!configured || !aeroExecutionEnabled) throw cloudError("The protected Aero execution route is not enabled.", 503, "execution_disabled");
      return callAeroExecution(Object.assign({ op: "cancel" }, payload || {}), true);
    },

    async inspectAeroRun(runId) {
      if (!configured || !aeroExecutionEnabled) throw cloudError("The protected Aero execution route is not enabled.", 503, "execution_disabled");
      return callAeroExecution({ op: "inspect", runId: runId }, true);
    },

    async forgetAeroRun(payload) {
      if (!configured || !aeroExecutionEnabled) throw cloudError("The protected Aero execution route is not enabled.", 503, "execution_disabled");
      return callAeroExecution(Object.assign({ op: "forget" }, payload || {}), true);
    },

    async readAeroMemory() {
      if (!configured || !aeroMemoryEnabled) throw cloudError("Private Aero memory is not enabled.", 503, "memory_disabled");
      return callAeroMemory({ op: "read" }, true);
    },

    async prepareAeroMemory(payload) {
      if (!configured || !aeroMemoryEnabled) throw cloudError("Private Aero memory is not enabled.", 503, "memory_disabled");
      return callAeroMemory(Object.assign({ op: "prepare" }, payload || {}), true);
    },

    async commitAeroMemory(payload) {
      if (!configured || !aeroMemoryEnabled) throw cloudError("Private Aero memory is not enabled.", 503, "memory_disabled");
      return callAeroMemory(Object.assign({ op: "commit" }, payload || {}), true);
    },

    async observeAeroMemory(payload) {
      if (!configured || !aeroMemoryEnabled) throw cloudError("Private Aero memory is not enabled.", 503, "memory_disabled");
      return callAeroMemory(Object.assign({ op: "observe" }, payload || {}), true);
    },

    async cancelAeroMemory(payload) {
      if (!configured || !aeroMemoryEnabled) throw cloudError("Private Aero memory is not enabled.", 503, "memory_disabled");
      return callAeroMemory(Object.assign({ op: "cancel" }, payload || {}), true);
    },

    async inspectAeroMemory(transactionId) {
      if (!configured || !aeroMemoryEnabled) throw cloudError("Private Aero memory is not enabled.", 503, "memory_disabled");
      return callAeroMemory({ op: "inspect", transactionId: transactionId }, true);
    },

    async forgetAeroMemoryTransaction(payload) {
      if (!configured || !aeroMemoryEnabled) throw cloudError("Private Aero memory is not enabled.", 503, "memory_disabled");
      return callAeroMemory(Object.assign({ op: "forget_transaction" }, payload || {}), true);
    },

    async signInEmail(email) {
      lastAuthError = "";
      await ensureClient();
      var cleanEmail = String(email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Enter a valid email address");
      var result = await sb.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: location.origin + location.pathname
        }
      });
      if (result && result.error) throw result.error;
      return result;
    },

    async verifyEmailOtp(email, token) {
      lastAuthError = "";
      await ensureClient();
      var cleanEmail = String(email || "").trim().toLowerCase();
      var cleanToken = String(token || "").replace(/\D/g, "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Enter the email address that received the code");
      if (!/^\d{6}$/.test(cleanToken)) throw new Error("Enter the six-digit code");
      var result = await sb.auth.verifyOtp({ email: cleanEmail, token: cleanToken, type: "email" });
      if (result && result.error) throw result.error;
      var session = result && result.data ? result.data.session : null;
      current = userFrom(session);
      if (session && session.provider_token) googleProviderToken = String(session.provider_token);
      return result;
    },

    async signOut() {
      try { if (sb) await sb.auth.signOut(); } catch (e) {}
      current = null;
      googleProviderToken = "";
      confirmedRev = 0;
      queuedRemote = null;
    },

    async pull() {
      if (!sb || !current) return null;
      var r = await sb.from(TABLE).select("data, rev").eq("user_id", current.id).maybeSingle();
      if (r.error) throw r.error;
      if (!r.data) {
        rememberConfirmed(null, 0);
        return null;
      }
      rememberConfirmed(r.data.data, Number(r.data.rev || 0));
      return { data: r.data.data, rev: r.data.rev || 0 };
    },

    async push(data, rev) {
      if (!sb || !current) return false;
      var requestedRev = Number(rev || 0);
      var snapshot = sanitize(data);
      if (aeroExecutionEnabled) {
        if (!Number.isSafeInteger(requestedRev) || requestedRev < 1) throw cloudError("The Lyfe revision is invalid.", 409, "invalid_revision");
        pendingWrites += 1;
        var operation = writeChain.catch(function () {}).then(async function () {
          var committed = await sb.rpc("lyfe_compare_and_swap_state", {
            p_expected_rev: confirmedRev,
            p_data: snapshot,
          });
          if (committed.error) throw committed.error;
          var result = committed.data || {};
          if (!result.applied) {
            if (result.data && typeof result.rev === "number") rememberConfirmed(result.data, result.rev);
            emitCloudConflict(result);
            return false;
          }
          if (result.data && typeof result.rev === "number") rememberConfirmed(result.data, result.rev);
          return result;
        });
        writeChain = operation;
        return operation.finally(function () {
          pendingWrites = Math.max(0, pendingWrites - 1);
          releaseQueuedRemote();
        });
      }
      var r = await sb.from(TABLE).upsert({
        user_id: current.id,
        data: snapshot,
        rev: requestedRev,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (r.error) throw r.error;
      return true;
    },

    pushDebounced: function (data, rev) {
      clearTimeout(pushTimer);
      var snapshot = sanitize(data);
      var snapshotRev = Number(rev || 0);
      pushTimer = setTimeout(function () {
        LyfeCloud.push(snapshot, snapshotRev).catch(function () {
          /* offline: the local cache already holds this write, it will
             re-push on the next save once the connection is back */
        });
      }, 800);
    },

    flush: async function (data, rev) {
      clearTimeout(pushTimer);
      pushTimer = null;
      return LyfeCloud.push(data, rev);
    },

    subscribe: function (onRemote) {
      if (!sb || !current) return;
      try {
        sb.channel("lyfe-" + current.id)
          .on("postgres_changes",
            { event: "*", schema: "public", table: TABLE, filter: "user_id=eq." + current.id },
            function (payload) {
              var n = payload && payload.new;
              if (!(n && typeof n.rev === "number")) return;
              if (aeroExecutionEnabled) {
                if (pendingWrites > 0 || pushTimer) {
                  if (!queuedRemote || n.rev > queuedRemote.rev) queuedRemote = { data: n.data, rev: n.rev, onRemote: onRemote };
                  return;
                }
                if (n.rev <= confirmedRev) return;
                rememberConfirmed(n.data, n.rev);
              }
              onRemote({ data: n.data, rev: n.rev });
            })
          .subscribe();
      } catch (e) { /* realtime is a bonus, never a blocker */ }
    },

    async pullConnect() {
      if (!sb || !current) return null;
      var r = await sb.from(CONNECT_TABLE).select("data, rev").eq("user_id", current.id).maybeSingle();
      if (r.error) throw r.error;
      if (!r.data) return null;
      return { data: r.data.data, rev: r.data.rev || 0 };
    },

    async pushConnect(data, rev) {
      if (!sb || !current) return false;
      var r = await sb.from(CONNECT_TABLE).upsert({
        user_id: current.id,
        data: sanitize(data),
        rev: Number(rev || 0),
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (r.error) throw r.error;
      return true;
    },

    pushConnectDebounced: function (data, rev) {
      clearTimeout(connectPushTimer);
      connectPushTimer = setTimeout(function () {
        LyfeCloud.pushConnect(data, rev).catch(function () {
          /* The local copy remains available and will retry after the next edit. */
        });
      }, 800);
    },

    subscribeConnect: function (onRemote) {
      if (!sb || !current) return;
      try {
        sb.channel("lyfe-connect-" + current.id)
          .on("postgres_changes",
            { event: "*", schema: "public", table: CONNECT_TABLE, filter: "user_id=eq." + current.id },
            function (payload) {
              var n = payload && payload.new;
              if (n && typeof n.rev === "number") onRemote({ data: n.data, rev: n.rev });
            })
          .subscribe();
      } catch (e) { /* realtime is optional */ }
    }
  };

  window.LyfeCloud = LyfeCloud;
})();
