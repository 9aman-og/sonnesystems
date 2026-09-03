(function () {
  "use strict";

  var GUEST_KEY = "lyfe.v1";
  var state = {
    data: null,
    activeKey: GUEST_KEY,
    cloudMode: false,
    authStatus: "loading",
    user: null,
    cloudRev: 0,
    connectData: null,
    gmailMessages: [],
    gmailStatus: "idle",
  };
  var listeners = [];

  function id(prefix) {
    try { return (prefix || "item") + "_" + crypto.randomUUID(); }
    catch (error) { return (prefix || "item") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function array(value) {
    return Array.isArray(value) ? value.filter(function (item) { return item && typeof item === "object"; }) : [];
  }

  function initialData() {
    var threadId = id("thread");
    return {
      rev: 0,
      savedAt: 0,
      version: 1,
      settings: {
        name: "",
        nameSet: false,
        theme: "light",
        provider: "auto",
        aeroCloudEnabled: false,
        aeroSources: {
          today: true,
          tracking: true,
          library: true,
          connect: true,
          gmail: true,
          profile: true,
          knowledge: true,
        },
        aeroLocalLearning: true,
        aeroTrainingConsent: false,
        aeroProactiveMode: "brief",
        sound: true,
        onboarded: false,
      },
      tasks: [], projects: [], goals: [], education: [], worklog: [],
      notes: [], docs: [], saved: [], chat: [],
      aeroThreads: [{ id: threadId, title: "New chat", projectId: null, createdAt: Date.now(), updatedAt: Date.now() }],
      aeroActiveThreadId: threadId,
      aeroAttention: window.AeroAttention ? window.AeroAttention.freshState() : { day: "", proactiveCount: 0, lastProactiveAt: 0, proactiveFingerprints: [], notifications: [] },
      aeroRuns: [],
      aero: window.AeroCore ? window.AeroCore.freshState() : { version: 1, memories: [], episodes: [], lastContext: null },
    };
  }

  function normalize(raw) {
    var defaults = initialData();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
    var next = Object.assign({}, defaults, raw);
    next.settings = Object.assign({}, defaults.settings, raw.settings || {});
    next.settings.aeroSources = Object.assign({}, defaults.settings.aeroSources, raw.settings && raw.settings.aeroSources || {});
    ["tasks", "projects", "goals", "education", "worklog", "notes", "docs", "saved", "chat", "aeroThreads", "aeroRuns"].forEach(function (key) {
      next[key] = array(raw[key]);
    });
    if (!next.aeroThreads.length) {
      var threadId = id("thread");
      next.aeroThreads.push({ id: threadId, title: "New chat", projectId: null, createdAt: Date.now(), updatedAt: Date.now() });
      next.aeroActiveThreadId = threadId;
    }
    if (!next.aeroThreads.some(function (thread) { return thread.id === next.aeroActiveThreadId; })) next.aeroActiveThreadId = next.aeroThreads[0].id;
    next.aero = window.AeroCore ? window.AeroCore.normalize(raw.aero) : (raw.aero || defaults.aero);
    next.aeroAttention = window.AeroAttention
      ? window.AeroAttention.normalize(raw.aeroAttention)
      : Object.assign({}, defaults.aeroAttention, raw.aeroAttention || {});
    next.aeroRuns = window.AeroHarness ? next.aeroRuns.map(window.AeroHarness.normalize).filter(Boolean).slice(-200) : next.aeroRuns;
    next.rev = Math.max(0, Number(raw.rev || 0));
    next.savedAt = Math.max(0, Number(raw.savedAt || 0));
    return next;
  }

  function readLocal(key) {
    try {
      var value = localStorage.getItem(key);
      return value ? normalize(JSON.parse(value)) : initialData();
    } catch (error) {
      return initialData();
    }
  }

  function notify(reason) {
    listeners.slice().forEach(function (listener) {
      try { listener(state.data, reason || "update"); } catch (error) { /* one view cannot block storage */ }
    });
  }

  function persistLocal() {
    var current = state.data || initialData();
    var storedRev = 0;
    try {
      var stored = JSON.parse(localStorage.getItem(state.activeKey) || "null");
      storedRev = stored && Number(stored.rev || 0) || 0;
    } catch (error) { storedRev = 0; }
    var rev = Math.max(Number(current.rev || 0), storedRev) + 1;
    var payload = Object.assign({ rev: rev }, current, { rev: rev, savedAt: Date.now() });
    state.data = payload;
    try { localStorage.setItem(state.activeKey, JSON.stringify(payload)); } catch (error) { /* memory remains authoritative for this session */ }
    return payload;
  }

  function save(reason, immediate) {
    var payload = persistLocal();
    if (state.cloudMode && window.LyfeCloud && window.LyfeCloud.user) {
      if (immediate && typeof window.LyfeCloud.push === "function") {
        window.LyfeCloud.push(payload, payload.rev).catch(function () { /* local copy remains safe */ });
      } else if (typeof window.LyfeCloud.pushDebounced === "function") {
        window.LyfeCloud.pushDebounced(payload, payload.rev);
      }
    }
    notify(reason || "save");
    return payload;
  }

  function replace(next, reason, shouldSave) {
    state.data = normalize(next);
    if (shouldSave !== false) save(reason || "replace");
    else notify(reason || "replace");
    return state.data;
  }

  function adopt(next, revision, reason) {
    state.data = normalize(next);
    state.data.rev = Math.max(0, Number(revision == null ? state.data.rev : revision));
    state.data.savedAt = Date.now();
    state.cloudRev = Math.max(state.cloudRev, state.data.rev);
    try { localStorage.setItem(state.activeKey, JSON.stringify(Object.assign({ rev: state.data.rev }, state.data))); } catch (error) { /* session state remains usable */ }
    notify(reason || "authoritative-update");
    return state.data;
  }

  function update(mutator, reason, immediate) {
    if (typeof mutator === "function") mutator(state.data);
    return save(reason || "update", immediate);
  }

  function activeThread() {
    return state.data.aeroThreads.find(function (thread) { return thread.id === state.data.aeroActiveThreadId; }) || state.data.aeroThreads[0];
  }

  function appendMessage(role, text, metadata) {
    var thread = activeThread();
    var now = Date.now();
    metadata = metadata || {};
    state.data.chat.push(Object.assign({
      id: id("message"),
      role: role,
      text: String(text || "").slice(0, 8000),
      ts: now,
      threadId: thread.id,
      attachments: [],
    }, metadata));
    if (role === "user" && thread.title === "New chat") thread.title = String(text || "New chat").replace(/\s+/g, " ").trim().slice(0, 68) || "New chat";
    thread.updatedAt = now;
    return thread;
  }

  function subject(action) {
    return String(action && (action.title || action.name || action.claim || action.query || action.text || action.body) || "item").trim();
  }

  function findOpenTask(title) {
    var needle = String(title || "").toLowerCase().trim();
    return state.data.tasks.find(function (task) {
      var value = String(task.title || "").toLowerCase().trim();
      return task.status !== "done" && task.status !== "completed" && (value === needle || value.indexOf(needle) >= 0 || needle.indexOf(value) >= 0);
    });
  }

  function applyAction(action) {
    var before = clone(state.data);
    var now = Date.now();
    var record = null;
    var title = subject(action);
    switch (action.type) {
      case "add_task":
        record = { id: id("task"), title: action.title, area: action.area || "Personal", priority: action.priority || "Medium", due: action.due || null, dueTime: "", important: action.priority === "High", projectId: null, notes: action.description || "", status: "open", createdAt: now, completedAt: null, alarmAck: false };
        state.data.tasks.push(record);
        break;
      case "complete_task":
        record = findOpenTask(action.title);
        if (!record) throw new Error("That open task could not be found.");
        record.status = "done";
        record.completedAt = now;
        break;
      case "add_note":
        record = { id: id("note"), title: action.title || title.slice(0, 72) || "New note", body: action.body || "", pinned: false, createdAt: now, updatedAt: now };
        state.data.notes.push(record);
        break;
      case "add_doc":
        record = { id: id("doc"), title: action.title || title.slice(0, 72) || "New document", body: action.body || "", createdAt: now, updatedAt: now };
        state.data.docs.push(record);
        break;
      case "add_project":
        record = { id: id("project"), name: action.name || action.title, description: action.description || "", area: action.area || "Work", status: "active", start: new Date(now).toISOString().slice(0, 10), end: null, createdAt: now, updatedAt: now };
        state.data.projects.push(record);
        break;
      case "add_goal":
        record = { id: id("goal"), title: action.title, why: action.why || "", area: action.area || "Personal", horizon: action.horizon || null, status: "active", createdAt: now, achievedAt: null };
        state.data.goals.push(record);
        break;
      case "add_education":
        record = { id: id("learning"), title: action.title, provider: action.provider || "", kind: action.kind || "Skill", status: "in-progress", started: action.date || new Date(now).toISOString().slice(0, 10), completed: null, notes: action.description || "", createdAt: now, updatedAt: now };
        state.data.education.push(record);
        break;
      case "log_work":
        record = { id: id("work"), text: action.text, hours: Number(action.hours || 0), date: action.date || new Date(now).toISOString().slice(0, 10), projectId: null, createdAt: now };
        state.data.worklog.push(record);
        break;
      case "memory_upsert":
        if (!window.AeroCore) throw new Error("The memory engine is unavailable.");
        state.data.aero = window.AeroCore.upsertMemory(state.data.aero, { claim: action.claim, type: action.memoryType || "semantic", scope: action.scope || "global", memoryKey: action.memoryKey || "", sourceMode: "explicit", status: "active", confidence: 1, sourceRefs: [{ kind: "user-instruction", id: id("source"), label: "Direct instruction", at: now }] });
        record = { id: action.memoryKey || title, claim: action.claim };
        break;
      case "memory_forget":
        if (!window.AeroCore) throw new Error("The memory engine is unavailable.");
        state.data.aero = window.AeroCore.forgetMemory(state.data.aero, action.query || action.claim);
        record = { id: action.query || action.claim, forgotten: true };
        break;
      default:
        throw new Error("This action is not supported.");
    }
    return { applied: 1, before: before, record: clone(record), actionType: action.type, subject: title };
  }

  function compensate(action, result) {
    if (!(result && result.before)) return false;
    state.data = normalize(result.before);
    return true;
  }

  function audit(action, result) {
    var observedAt = Date.now();
    var ok = !!(result && result.applied === 1);
    if (action.type === "add_task") ok = state.data.tasks.some(function (item) { return item.id === result.record.id && item.status === "open"; });
    else if (action.type === "complete_task") ok = state.data.tasks.some(function (item) { return item.id === result.record.id && (item.status === "done" || item.status === "completed"); });
    else if (action.type === "add_note") ok = state.data.notes.some(function (item) { return item.id === result.record.id; });
    else if (action.type === "add_doc") ok = state.data.docs.some(function (item) { return item.id === result.record.id; });
    else if (action.type === "add_project") ok = state.data.projects.some(function (item) { return item.id === result.record.id; });
    else if (action.type === "add_goal") ok = state.data.goals.some(function (item) { return item.id === result.record.id; });
    else if (action.type === "add_education") ok = state.data.education.some(function (item) { return item.id === result.record.id; });
    else if (action.type === "log_work") ok = state.data.worklog.some(function (item) { return item.id === result.record.id; });
    return {
      verified: ok,
      integrity: ok ? "clean" : "failed",
      auditor: "aero-read-only-store-audit",
      facts: ok ? [action.type + " verified"] : [],
      evidence: ok ? [{ type: "record-observation", source: "workspace-store", ref: String(result.record.id || result.subject), claim: "The requested record matches the approved action.", observedAt: observedAt }] : [],
    };
  }

  function gmailHeader(message, name) {
    var headers = message && message.payload && Array.isArray(message.payload.headers) ? message.payload.headers : [];
    var hit = headers.find(function (header) { return String(header.name || "").toLowerCase() === name.toLowerCase(); });
    return hit ? String(hit.value || "") : "";
  }

  function gmailSender(value) {
    var raw = String(value || "").trim();
    var named = raw.match(/^\s*"?([^"<]+?)"?\s*</);
    return (named ? named[1] : raw.replace(/<[^>]+>/g, "")).trim() || "Unknown sender";
  }

  async function loadGmail(force) {
    var token = window.LyfeCloud && window.LyfeCloud.gmailToken;
    if (!token || state.gmailStatus === "loading" || (state.gmailStatus === "ready" && !force)) return state.gmailMessages;
    state.gmailStatus = "loading";
    notify("gmail-loading");
    try {
      var listResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=10", { headers: { Authorization: "Bearer " + token } });
      if (!listResponse.ok) {
        if ((listResponse.status === 401 || listResponse.status === 403) && window.LyfeCloud.clearGmailToken) window.LyfeCloud.clearGmailToken();
        throw new Error("Mail permission needs to be renewed.");
      }
      var list = await listResponse.json();
      var ids = Array.isArray(list.messages) ? list.messages.slice(0, 10) : [];
      var details = await Promise.all(ids.map(async function (item) {
        var response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + encodeURIComponent(item.id) + "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date", { headers: { Authorization: "Bearer " + token } });
        if (!response.ok) return null;
        var message = await response.json();
        var rawDate = gmailHeader(message, "Date");
        var parsed = rawDate ? new Date(rawDate) : null;
        return { id: String(message.id || item.id), sender: gmailSender(gmailHeader(message, "From")), subject: gmailHeader(message, "Subject"), snippet: String(message.snippet || "").slice(0, 240), date: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : "" };
      }));
      state.gmailMessages = details.filter(Boolean);
      state.gmailStatus = "ready";
      notify("gmail-ready");
      return state.gmailMessages;
    } catch (error) {
      state.gmailMessages = [];
      state.gmailStatus = "error";
      notify("gmail-error");
      return [];
    }
  }

  function restoreAction(action, result) {
    return compensate(action, result);
  }

  async function boot() {
    state.data = readLocal(GUEST_KEY);
    try {
      state.connectData = JSON.parse(localStorage.getItem("lyfe.connect.suite.v1") || localStorage.getItem("lyfe.connect.preview.v1") || "null");
    } catch (error) { state.connectData = null; }
    state.authStatus = "guest";
    if (!window.LyfeCloud) {
      notify("boot");
      return state;
    }
    var status = "unconfigured";
    try { status = await window.LyfeCloud.init(); } catch (error) { status = "unconfigured"; }
    if (status === "cloud" && window.LyfeCloud.user) {
      state.cloudMode = true;
      state.user = window.LyfeCloud.user;
      state.authStatus = "cloud";
      state.activeKey = "lyfe.cloud." + state.user.id;
      var local = readLocal(state.activeKey);
      var remote = null;
      try { remote = await window.LyfeCloud.pull(); } catch (error) { remote = null; }
      if (remote && remote.data) {
        state.data = normalize(remote.data);
        state.data.rev = Math.max(state.data.rev || 0, Number(remote.rev || 0));
        state.cloudRev = Number(remote.rev || 0);
        try { localStorage.setItem(state.activeKey, JSON.stringify(state.data)); } catch (error) { /* offline session can continue */ }
      } else {
        state.data = local;
      }
      if (window.LyfeCloud.aeroMemoryEnabled && typeof window.LyfeCloud.readAeroMemory === "function" && window.AeroCore) {
        try {
          var memory = await window.LyfeCloud.readAeroMemory();
          if (memory && memory.state) state.data.aero = window.AeroCore.normalize(memory.state);
        } catch (error) {
          state.data.aero = window.AeroCore.freshState();
        }
      }
      if (typeof window.LyfeCloud.pullConnect === "function") {
        try {
          var connected = await window.LyfeCloud.pullConnect();
          if (connected && connected.data) state.connectData = connected.data;
        } catch (error) { /* local people context remains available */ }
      }
      if (typeof window.LyfeCloud.subscribe === "function") {
        window.LyfeCloud.subscribe(function (payload) {
          if (!payload || Number(payload.rev || 0) <= Number(state.data.rev || 0)) return;
          state.data = normalize(payload.data);
          state.data.rev = Number(payload.rev || state.data.rev || 0);
          state.cloudRev = state.data.rev;
          try { localStorage.setItem(state.activeKey, JSON.stringify(state.data)); } catch (error) { /* optional cache */ }
          notify("cloud");
        });
      }
    } else if (status === "gate") {
      state.authStatus = "gate";
    } else {
      state.authStatus = "guest";
    }
    if (window.AeroKnowledge && typeof window.AeroKnowledge.setOwner === "function") {
      try { await window.AeroKnowledge.setOwner(state.user ? state.user.id : "guest"); } catch (error) { /* the app still runs without imported context */ }
    }
    notify("boot");
    if (window.LyfeCloud && window.LyfeCloud.gmailToken) loadGmail(false);
    return state;
  }

  async function signInGoogle() {
    if (!(window.LyfeCloud && window.LyfeCloud.configured)) throw new Error("Account sync is not configured here.");
    return window.LyfeCloud.signInGoogle();
  }

  async function signInEmail(email) {
    if (!(window.LyfeCloud && window.LyfeCloud.configured)) throw new Error("Account sync is not configured here.");
    return window.LyfeCloud.signInEmail(email);
  }

  async function verifyEmail(email, token) {
    if (!(window.LyfeCloud && window.LyfeCloud.configured)) throw new Error("Account sync is not configured here.");
    return window.LyfeCloud.verifyEmailOtp(email, token);
  }

  async function signOut() {
    if (window.LyfeCloud) await window.LyfeCloud.signOut();
    location.reload();
  }

  window.AeroStore = {
    state: state,
    boot: boot,
    get: function () { return state.data; },
    replace: replace,
    adopt: adopt,
    update: update,
    save: save,
    subscribe: function (listener) { listeners.push(listener); return function () { listeners = listeners.filter(function (item) { return item !== listener; }); }; },
    appendMessage: appendMessage,
    activeThread: activeThread,
    getConnect: function () { return state.connectData; },
    getGmail: function () { return state.gmailMessages.slice(); },
    loadGmail: loadGmail,
    applyAction: applyAction,
    compensate: compensate,
    restoreAction: restoreAction,
    audit: audit,
    id: id,
    clone: clone,
    signInGoogle: signInGoogle,
    signInEmail: signInEmail,
    verifyEmail: verifyEmail,
    signOut: signOut,
  };

  if (typeof window.addEventListener === "function") {
    window.addEventListener("storage", function (event) {
      if (event.key !== state.activeKey || !event.newValue) return;
      try {
        var incoming = JSON.parse(event.newValue);
        if (Number(incoming.rev || 0) <= Number(state.data && state.data.rev || 0)) return;
        state.data = normalize(incoming);
        notify("tab-sync");
      } catch (error) { /* malformed external state is ignored */ }
    });
  }
})();
