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
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.LYFE_SUPABASE || {};
  var SB_URL = String(CFG.url || "").trim();
  var SB_ANON = String(CFG.anonKey || "").trim();
  var configured = /^https:\/\/.+\.supabase\.co\/?$/.test(SB_URL) && SB_ANON.length > 20;
  var googleEnabled = CFG.googleEnabled === true;
  var providerSettingsChecked = false;

  // Exact pin keeps an upstream release from changing the app between deploys.
  var SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.2";
  var TABLE = "lyfe_states";
  var CONNECT_TABLE = "lyfe_connect_states";

  var sb = null;        // supabase client (created lazily)
  var current = null;   // { id, email, name }
  var googleProviderToken = ""; // memory-only: never copied into Lyfe data
  var lastAuthError = "";
  var authListenerAttached = false;
  var pushTimer = null;
  var connectPushTimer = null;

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
        googleProviderToken = String(session && session.provider_token || "");
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

  var LyfeCloud = {
    configured: configured,
    get googleEnabled() { return googleEnabled; },
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
          googleProviderToken = String(session.provider_token || "");
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
      lastAuthError = "";
      await refreshProviderSettings();
      if (!googleEnabled) throw new Error("Gmail connection is not ready on this deployment yet.");
      await ensureClient();
      var result = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: location.origin + location.pathname,
          scopes: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          queryParams: { access_type: "offline", prompt: "consent" }
        }
      });
      if (result && result.error) throw result.error;
      return result;
    },

    get gmailToken() { return googleProviderToken; },

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
      googleProviderToken = String(session && session.provider_token || "");
      return result;
    },

    async signOut() {
      try { if (sb) await sb.auth.signOut(); } catch (e) {}
      current = null;
      googleProviderToken = "";
    },

    async pull() {
      if (!sb || !current) return null;
      var r = await sb.from(TABLE).select("data, rev").eq("user_id", current.id).maybeSingle();
      if (r.error) throw r.error;
      if (!r.data) return null;
      return { data: r.data.data, rev: r.data.rev || 0 };
    },

    async push(data, rev) {
      if (!sb || !current) return false;
      var r = await sb.from(TABLE).upsert({
        user_id: current.id,
        data: sanitize(data),
        rev: rev,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (r.error) throw r.error;
      return true;
    },

    pushDebounced: function (data, rev) {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(function () {
        LyfeCloud.push(data, rev).catch(function () {
          /* offline: the local cache already holds this write, it will
             re-push on the next save once the connection is back */
        });
      }, 800);
    },

    subscribe: function (onRemote) {
      if (!sb || !current) return;
      try {
        sb.channel("lyfe-" + current.id)
          .on("postgres_changes",
            { event: "*", schema: "public", table: TABLE, filter: "user_id=eq." + current.id },
            function (payload) {
              var n = payload && payload.new;
              if (n && typeof n.rev === "number") onRemote({ data: n.data, rev: n.rev });
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
