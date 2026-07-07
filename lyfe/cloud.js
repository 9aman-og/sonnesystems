/* ============================================================
   Lyfe - cloud sync + auth (Supabase).  OPTIONAL layer.

   If supabase-config.js is empty, this module reports itself as
   "unconfigured" and the app runs local-only guest mode, exactly
   as before. Nothing here can break the offline app: every network
   path fails soft back to local.

   When configured, it adds Google sign-in and per-user cloud sync.
   Security is enforced server-side by Postgres row-level security
   (see schema.sql). The anon key is public by design.

   Public surface (window.LyfeCloud):
     .configured                      bool
     .user                            {id,email,name} | null
     await .init()  -> "cloud" | "gate" | "unconfigured"
     await .signInGoogle()
     await .signOut()
     await .pull()  -> {data,rev} | null
     await .push(data, rev)
     .pushDebounced(data, rev)
     .subscribe(onRemote)             onRemote({data,rev})
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.LYFE_SUPABASE || {};
  var SB_URL = String(CFG.url || "").trim();
  var SB_ANON = String(CFG.anonKey || "").trim();
  var configured = /^https:\/\/.+\.supabase\.co\/?$/.test(SB_URL) && SB_ANON.length > 20;

  // pinned major version; jsdelivr serves the latest stable 2.x
  var SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  var TABLE = "lyfe_states";

  var sb = null;        // supabase client (created lazily)
  var current = null;   // { id, email, name }
  var pushTimer = null;

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
    return sb;
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
    // after Google returns, drop the ?code=/#access_token noise from the bar
    if (location.search.indexOf("code=") > -1 || location.hash.indexOf("access_token") > -1) {
      try { history.replaceState(null, "", location.origin + location.pathname); } catch (e) {}
    }
  }

  var LyfeCloud = {
    configured: configured,
    get user() { return current; },

    /* Resolve auth on boot. Never throws.
       "cloud"        - a session exists, caller should sync + run
       "gate"         - configured but signed out, caller shows login screen
       "unconfigured" - no backend set up (or unreachable), run guest as today */
    async init() {
      if (!configured) return "unconfigured";
      try {
        await ensureClient();
        var res = await sb.auth.getSession();
        var session = res && res.data ? res.data.session : null;
        if (session) {
          current = userFrom(session);
          cleanUrl();
          return "cloud";
        }
        return "gate";
      } catch (e) {
        return "unconfigured"; // backend down: still open the app
      }
    },

    async signInGoogle() {
      await ensureClient();
      return sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: location.origin + location.pathname }
      });
    },

    async signOut() {
      try { if (sb) await sb.auth.signOut(); } catch (e) {}
      current = null;
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
    }
  };

  window.LyfeCloud = LyfeCloud;
})();
