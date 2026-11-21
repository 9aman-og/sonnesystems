(function () {
  "use strict";

  var store = window.AeroStore;
  var serverBindings = new Map();
  var accountOperations = new Map();
  var cloudBackoffUntil = 0;
  var PENDING_PREFIX = "altpsi.aero.pending.v1:";
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var HEX_DIGEST_RE = /^[0-9a-f]{64}$/i;
  var LOCAL_DIGEST_RE = /^sha256-[0-9a-f]{64}$/i;

  function clean(value, max) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 2000);
  }

  function currentAccount() {
    var owner = store.state.user && store.state.user.id;
    var cloud = window.LyfeCloud;
    return store.state.cloudMode && owner && cloud && cloud.user && cloud.user.id === owner ? owner : "";
  }

  function requireAccount(owner) {
    if (currentAccount() !== owner) throw new Error("Your account changed. Open the plan again.");
  }

  function withAccountOperation(operation) {
    var owner = currentAccount();
    if (!owner) {
      if (store.state.cloudMode) return Promise.reject(new Error("Sign in again to use account changes."));
      return Promise.resolve().then(function () { return operation(""); });
    }
    var invoke = function () {
      requireAccount(owner);
      return operation(owner);
    };
    if (typeof navigator !== "undefined" && navigator.locks) {
      return navigator.locks.request("altpsi.aero-actions:" + owner, invoke);
    }
    var previous = accountOperations.get(owner) || Promise.resolve();
    var next = previous.catch(function () {}).then(invoke);
    accountOperations.set(owner, next);
    return next.finally(function () { if (accountOperations.get(owner) === next) accountOperations.delete(owner); });
  }

  function pendingKey(owner, runId) {
    return PENDING_PREFIX + owner + ":" + encodeURIComponent(runId);
  }

  function normalizePending(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var localRunId = clean(raw.localRunId, 140);
    var remoteId = clean(raw.remoteId, 100);
    var kind = raw.kind === "memory" || raw.kind === "workspace" ? raw.kind : "";
    var phase = ["prepared", "committing", "uncertain", "completed", "expired", "stale", "cancelled"].indexOf(raw.phase) >= 0 ? raw.phase : "uncertain";
    var updatedAt = Math.max(0, Number(raw.updatedAt || 0));
    var preparedAt = Math.max(0, Number(raw.preparedAt || updatedAt));
    var contractDigest = clean(raw.contractDigest, 100);
    var targetDigest = clean(raw.targetDigest, 100);
    var localContractDigest = clean(raw.localContractDigest, 100);
    var baseRevision = raw.baseRevision;
    var requestKey = clean(raw.requestKey, 160);
    var stepTypes = Array.isArray(raw.stepTypes) ? raw.stepTypes.map(function (type) { return clean(type, 60); }) : [];
    if (!localRunId || !kind || !UUID_RE.test(remoteId) || !HEX_DIGEST_RE.test(contractDigest)
      || !HEX_DIGEST_RE.test(targetDigest) || !LOCAL_DIGEST_RE.test(localContractDigest)
      || !Number.isFinite(updatedAt) || !Number.isFinite(preparedAt) || !updatedAt || !preparedAt
      || !Number.isSafeInteger(baseRevision) || baseRevision < 0
      || requestKey !== requestKeyFor(localRunId, kind)
      || !stepTypes.length || stepTypes.length > window.AeroHarness.MAX_STEPS
      || !stepTypes.every(function (type) { return window.AeroHarness.actionAllowed({ type: type }); })) return null;
    return {
      localRunId: localRunId,
      remoteId: remoteId,
      kind: kind,
      contractDigest: contractDigest,
      targetDigest: targetDigest,
      localContractDigest: localContractDigest,
      requestKey: requestKey,
      baseRevision: baseRevision,
      presenceRequired: raw.presenceRequired === true,
      phase: phase,
      lastErrorCode: clean(raw.lastErrorCode, 80),
      preparedAt: preparedAt,
      updatedAt: updatedAt,
      stepTypes: stepTypes,
    };
  }

  function pendingFor(runId, owner) {
    owner = owner || currentAccount();
    if (!owner) return null;
    try {
      var entry = normalizePending(JSON.parse(localStorage.getItem(pendingKey(owner, runId)) || "null"));
      return entry && entry.localRunId === runId ? entry : null;
    } catch (error) { return null; }
  }

  function readPending(owner) {
    if (!owner) return [];
    var entries = [];
    var prefix = PENDING_PREFIX + owner + ":";
    try {
      for (var index = 0; index < localStorage.length; index++) {
        var key = localStorage.key(index);
        if (!key || key.indexOf(prefix) !== 0) continue;
        var entry = normalizePending(JSON.parse(localStorage.getItem(key) || "null"));
        if (entry && key === pendingKey(owner, entry.localRunId)) entries.push(entry);
      }
    } catch (error) { /* direct lookup remains available */ }
    return entries;
  }

  function savePending(entry, owner) {
    try {
      localStorage.setItem(pendingKey(owner, entry.localRunId), JSON.stringify(entry));
      return true;
    } catch (error) { return false; }
  }

  function rememberPending(run, binding, owner, phase) {
    requireAccount(owner);
    var previous = pendingFor(run.id, owner);
    var now = Date.now();
    var entry = normalizePending({
      localRunId: run.id,
      remoteId: remoteId(binding),
      kind: binding.kind,
      contractDigest: binding.contractDigest,
      targetDigest: binding.targetDigest,
      localContractDigest: run.contractDigest,
      requestKey: binding.requestKey,
      baseRevision: binding.baseRevision,
      presenceRequired: binding.presenceRequired,
      phase: phase,
      preparedAt: previous && previous.preparedAt || now,
      updatedAt: now,
      stepTypes: run.steps.map(function (step) { return step.action.type; }),
    });
    if (!entry || !savePending(entry, owner)) {
      var error = new Error("Aero needs browser storage to recover this change. Nothing was applied.");
      error.code = "recovery_storage_unavailable";
      throw error;
    }
    return entry;
  }

  function setPendingPhase(runId, owner, phase, errorCode) {
    var entry = pendingFor(runId, owner);
    if (entry) {
      entry.phase = phase;
      entry.lastErrorCode = clean(errorCode, 80);
      entry.updatedAt = Date.now();
      savePending(entry, owner);
    }
  }

  function forgetPending(runId, owner) {
    try { localStorage.removeItem(pendingKey(owner, runId)); } catch (error) { /* safe to inspect again */ }
  }

  function recoveryState(runId) {
    var pending = pendingFor(runId);
    if (!pending) return null;
    return {
      kind: pending.kind,
      phase: pending.phase,
      updatedAt: pending.updatedAt,
      lastErrorCode: pending.lastErrorCode,
    };
  }

  function rawDigest(value) {
    return clean(window.AeroHarness.digestValue(value), 100).replace(/^sha256-/, "");
  }

  function proofError(message) {
    var error = new Error(message || "Aero could not verify the server result.");
    error.code = "completion_proof_invalid";
    return error;
  }

  function isoDate(offset) {
    var date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + Number(offset || 0));
    return date.toISOString().slice(0, 10);
  }

  function cloudAvailable(data, attachments) {
    var settings = data && data.settings || {};
    var provider = ["auto", "groq", "offline"].indexOf(settings.provider) >= 0 ? settings.provider : "auto";
    return !attachments.length
      && settings.aeroCloudEnabled === true
      && provider !== "offline"
      && Date.now() >= cloudBackoffUntil
      && !!(window.LyfeCloud && window.LyfeCloud.user && window.LyfeCloud.aeroGatewayEnabled
        && typeof window.LyfeCloud.invokeAero === "function");
  }

  async function askProtectedSpecialist(request) {
    var response = await window.LyfeCloud.invokeAero({
      prompt: clean(request, 4000),
      date: isoDate(0),
      kind: window.AeroCore.classifyIntent(request),
    });
    var result = response && response.result && typeof response.result === "object" ? response.result : {};
    var bubbles = Array.isArray(result.bubbles) ? result.bubbles.map(function (item) { return clean(item, 1000); }).filter(Boolean).slice(0, 2) : [];
    if (!bubbles.length) throw new Error("The protected specialist returned no answer.");
    return {
      answer: bubbles.join("\n\n"),
      model: clean(response.model, 120) || "protected specialist",
      usage: response.usage && typeof response.usage === "object" ? {
        input: Math.max(0, Number(response.usage.input || 0)),
        output: Math.max(0, Number(response.usage.output || 0)),
      } : null,
      ignoredActionCount: Array.isArray(result.actions) ? result.actions.length : 0,
    };
  }

  function parseDue(value) {
    var text = clean(value).toLowerCase();
    if (/\btoday\b/.test(text)) return isoDate(0);
    if (/\btomorrow\b/.test(text)) return isoDate(1);
    var iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    return iso ? iso[1] : null;
  }

  function stripDue(value) {
    return clean(value)
      .replace(/\b(?:today|tomorrow)\b/gi, "")
      .replace(/\b(?:on|by|for)\s+20\d{2}-\d{2}-\d{2}\b/gi, "")
      .replace(/\s+/g, " ").replace(/[.,;:\s]+$/, "").trim();
  }

  function titleBody(value) {
    var body = clean(value);
    var first = body.split(/[.!?\n]/)[0].trim();
    return { title: (first || "New note").slice(0, 72), body: body };
  }

  function parseSingle(segment) {
    var text = clean(segment);
    var match;
    if (!text) return null;

    match = text.match(/^(?:please\s+)?(?:remind\s+me(?:\s+to)?|remember\s+to|(?:add|create|make)\s+(?:a\s+)?(?:task|todo)|task|todo|i\s+(?:need|have)\s+to|i\s+gotta)(?:\s*:\s*|\s+)(.+)$/i);
    if (match) return { type: "add_task", title: stripDue(match[1]), due: parseDue(match[1]), priority: /\b(?:urgent|important|high priority)\b/i.test(match[1]) ? "High" : "Medium" };

    match = text.match(/^(?:please\s+)?(?:mark|complete|finish|check\s+off)\s+(.+?)(?:\s+as\s+done)?$/i);
    if (!match) match = text.match(/^(?:done|finished|completed?)\s*:?\s+(.+)$/i);
    if (match) return { type: "complete_task", title: clean(match[1], 240) };

    match = text.match(/^(?:note|note\s+down|jot\s+down)\s*:?\s+(.+)$/i);
    if (match) {
      var note = titleBody(match[1]);
      return { type: "add_note", title: note.title, body: note.body };
    }

    match = text.match(/^(?:create|add|write)\s+(?:a\s+)?(?:doc|document)\s*:?\s+(.+)$/i);
    if (match) {
      var doc = titleBody(match[1]);
      return { type: "add_doc", title: doc.title, body: doc.body };
    }

    match = text.match(/^(?:create|add|start)\s+(?:a\s+)?project\s*:?\s+(.+)$/i);
    if (match) return { type: "add_project", name: clean(match[1], 240) };

    match = text.match(/^(?:create|add|set)\s+(?:a\s+)?goal\s*:?\s+(.+)$/i);
    if (!match) match = text.match(/^goal\s*:?\s+(.+)$/i);
    if (match) return { type: "add_goal", title: clean(match[1], 240) };

    match = text.match(/^(?:track|add)\s+(?:a\s+)?(?:course|skill|learning)\s*:?\s+(.+)$/i);
    if (!match) match = text.match(/^(?:i(?:'m| am)\s+learning)\s+(.+)$/i);
    if (match) return { type: "add_education", title: clean(match[1], 240) };

    match = text.match(/^(?:log|record)\s+([0-9]+(?:\.[0-9]+)?)\s*(?:h|hr|hrs|hours?)\s+(?:on\s+)?(.+)$/i);
    if (!match) match = text.match(/^(?:worked|spent)\s+([0-9]+(?:\.[0-9]+)?)\s*(?:h|hr|hrs|hours?)\s+(?:on\s+)?(.+)$/i);
    if (match) return { type: "log_work", hours: Math.min(24, Number(match[1])), text: clean(match[2], 2000), date: isoDate(0) };

    match = text.match(/^(?:remember\s+that|learn\s+that)\s+(.+)$/i);
    if (match) return { type: "memory_upsert", claim: clean(match[1], 800), memoryType: "semantic", scope: "global" };

    match = text.match(/^forget\s+(?:that\s+)?(.+)$/i);
    if (match) return { type: "memory_forget", query: clean(match[1], 800) };
    return null;
  }

  function actionRequest(request) {
    var parts = String(request || "").split(/\s+(?:and then|then|also)\s+|[;\r\n]+/i)
      .map(function (part) { return clean(part); }).filter(Boolean);
    var actions = parts.map(parseSingle).filter(Boolean);
    var problem = actions.length && actions.length !== parts.length
      ? "I couldn’t read every step. Put each change on its own line and use a verb like “create,” “complete,” or “log.”"
      : actions.length > window.AeroHarness.MAX_STEPS ? "Split this into shorter plans so you can review every step." : "";
    return { actions: problem ? [] : actions, intent: parts.join("; "), problem: problem };
  }

  function parseActions(request) {
    return actionRequest(request).actions;
  }

  function topTasks(data, limit) {
    var weight = { High: 0, Medium: 1, Low: 2 };
    return data.tasks.filter(function (task) { return task.status !== "done" && task.status !== "completed"; }).sort(function (a, b) {
      var dueA = a.due || "9999-99-99";
      var dueB = b.due || "9999-99-99";
      return dueA.localeCompare(dueB) || (weight[a.priority] || 1) - (weight[b.priority] || 1) || Number(a.createdAt || 0) - Number(b.createdAt || 0);
    }).slice(0, limit || 3);
  }

  function localAnswer(request, data, decision, context) {
    var value = clean(request).toLowerCase();
    var tasks = topTasks(data, 3);
    if (decision && decision.mode === "clarify") return decision.question || "What should I apply that to?";
    var knowledge = context && Array.isArray(context.sources) ? context.sources.find(function (source) { return source.id === "knowledge"; }) : null;
    if (knowledge && knowledge.items && knowledge.items.length && /\b(?:file|document|import|attachment|notes?|says?|mention|according)\b/.test(value)) {
      var item = knowledge.items[0];
      return "In “" + item.title + "”: " + clean(item.detail, 420);
    }
    if (/\b(?:what matters|priority|priorities|due|what(?:'s| is) next|today)\b/.test(value)) {
      if (!tasks.length) return "Your queue is clear. Pick the outcome you want to move next.";
      return "Start with “" + tasks[0].title + ".”" + (tasks[0].due ? " It is the nearest dated commitment." : " It is the strongest open commitment in view.");
    }
    if (/\b(?:how am i doing|progress|status)\b/.test(value)) {
      var done = data.tasks.filter(function (task) { return task.status === "done" || task.status === "completed"; }).length;
      var active = data.projects.filter(function (project) { return project.status !== "completed"; }).length;
      return done + " tasks are complete and " + active + " workspaces are active. Your next open loop is " + (tasks[0] ? "“" + tasks[0].title + ".”" : "clear.");
    }
    if (/\b(?:projects?|workspaces?)\b/.test(value)) {
      var activeProjects = data.projects.filter(function (project) { return project.status !== "completed"; });
      return activeProjects.length ? "You have " + activeProjects.length + " active workspace" + (activeProjects.length === 1 ? "" : "s") + ". “" + (activeProjects[0].name || activeProjects[0].title) + "” moved most recently." : "There are no active workspaces yet.";
    }
    if (/\b(?:memory|remembered|know about me)\b/.test(value)) {
      var memories = data.aero && Array.isArray(data.aero.memories) ? data.aero.memories.filter(function (item) { return item.status === "active" || item.status === "provisional"; }) : [];
      return memories.length ? "I have " + memories.length + " active memor" + (memories.length === 1 ? "y" : "ies") + ". You can inspect or remove any of them in Archive." : "I have no active long-term memory yet.";
    }
    return "I can help reason about this, but I need the outcome you want. What should be different when we’re done?";
  }

  function flowFor(request, actions) {
    var user = { id: "turn.user", label: "Your request", origin: "user", sensitivity: "private" };
    var fields = {};
    actions.forEach(function (action, index) {
      Object.keys(action).forEach(function (key) {
        if (key !== "type") fields[index + "." + key] = [user.id];
      });
    });
    return { mode: "enforce", sources: [user], influences: [user.id], fields: fields };
  }

  function responseForRun(run) {
    if (!run.flowDecision || !run.flowDecision.ok) return "I blocked that plan because its action authority did not match your request.";
    var count = run.steps.length;
    if (count === 1) return run.steps[0].title;
    return count + " exact changes are ready for review.";
  }

  async function propose(request, attachments) {
    var data = store.get();
    var text = clean(request);
    var safeAttachments = Array.isArray(attachments) ? attachments.slice(0, 12) : [];
    var thread = store.activeThread();
    var episode = window.AeroCore.beginEpisode(data.aero, text, "aero", thread.id);
    data.aero = episode.aero;
    store.appendMessage("user", text, {
      episodeId: episode.episode.id,
      attachments: safeAttachments.map(function (item) { return { id: item.id, name: item.name, type: item.type, size: item.size, localOnly: true }; }),
    });

    var requestPlan = actionRequest(request);
    var intentFamily = window.AeroCore.classifyIntent(text);
    // The v0 specialist is intentionally narrow: it answers context-free general
    // questions only. Triage, research, follow-up, organization, and memory
    // requests can imply workspace context even when the user omits "my".
    var mayUseCloud = intentFamily === "general" && !requestPlan.problem && !requestPlan.actions.length
      && cloudAvailable(data, safeAttachments);
    var plan = window.AeroCore.routePlan({ signal: text, engines: { ollama: false, groq: mayUseCloud, gpt: false, gemini: false }, cloudAllowed: mayUseCloud });
    var context = window.AeroCore.contextPack({
      surface: "now",
      lyfe: data,
      sourcePolicy: data.settings.aeroSources || {},
      activeObject: null,
      connect: store.getConnect && store.getConnect() || {},
      gmail: store.getGmail && store.getGmail() || [],
      knowledge: window.AeroKnowledge ? window.AeroKnowledge.context(text, 6) : [],
      aero: data.aero,
    });
    var decision = window.AeroCore.epistemicDecision({ signal: text, context: context });
    var actions = requestPlan.actions;

    if (!actions.length || decision.mode === "clarify") {
      var answer = "";
      var notice = "";
      var specialist = null;
      if (decision.mode !== "clarify" && plan.engine === "groq") {
        try {
          specialist = await askProtectedSpecialist(text);
          answer = specialist.answer;
          plan.model = specialist.model;
          plan.usage = specialist.usage;
          plan.reason = "current prompt only; no workspace context";
        } catch (error) {
          var status = Number(error && error.status || 0);
          cloudBackoffUntil = Date.now() + (status === 429 ? 60_000 : 30_000);
          plan.engine = "built-in";
          plan.reason = "protected route unavailable; local fallback";
          notice = error && error.message ? error.message : "The protected model is unavailable; Aero stayed local.";
        }
      }
      if (!answer) answer = requestPlan.problem || localAnswer(text, data, decision, context);
      data.aero = window.AeroCore.finishEpisode(data.aero, episode.episode.id, decision.mode === "clarify" ? "missed" : "answered", { route: plan.engine, actionTypes: [] });
      store.appendMessage("assistant", answer, {
        episodeId: episode.episode.id,
        route: { engine: plan.engine, reason: plan.reason, model: plan.model || "", usage: plan.usage || null },
      });
      store.save("aero-answer");
      return { kind: "answer", answer: answer, plan: plan, decision: decision, episodeId: episode.episode.id, context: context, notice: notice };
    }

    var run = window.AeroHarness.createRun({
      threadId: thread.id,
      episodeId: episode.episode.id,
      intent: requestPlan.intent,
      actions: actions,
      flow: flowFor(requestPlan.intent, actions),
    });
    data.aeroRuns.push(run);
    data.aeroRuns = data.aeroRuns.slice(-200);
    var response = responseForRun(run);
    store.appendMessage("assistant", response, { episodeId: episode.episode.id, proposal: run.id });
    store.cache("aero-proposal");
    return { kind: run.flowDecision && run.flowDecision.ok ? "proposal" : "blocked", answer: response, run: run, plan: plan, decision: decision, episodeId: episode.episode.id, context: context };
  }

  function proposeActions(intent, actions) {
    var data = store.get();
    var text = clean(intent);
    var thread = store.activeThread();
    var episode = window.AeroCore.beginEpisode(data.aero, text, "aero", thread.id);
    data.aero = episode.aero;
    store.appendMessage("user", text, { episodeId: episode.episode.id });
    var run = window.AeroHarness.createRun({
      threadId: thread.id,
      episodeId: episode.episode.id,
      intent: text,
      actions: actions,
      flow: flowFor(text, actions),
    });
    data.aeroRuns.push(run);
    data.aeroRuns = data.aeroRuns.slice(-200);
    var response = responseForRun(run);
    store.appendMessage("assistant", response, { episodeId: episode.episode.id, proposal: run.id });
    store.cache("aero-proposal");
    return { kind: run.flowDecision && run.flowDecision.ok ? "proposal" : "blocked", answer: response, run: run, episodeId: episode.episode.id };
  }

  function replaceRun(next) {
    var data = store.get();
    var index = data.aeroRuns.findIndex(function (run) { return run.id === next.id; });
    if (index >= 0) data.aeroRuns[index] = next;
    else data.aeroRuns.push(next);
    data.aeroRuns = data.aeroRuns.slice(-200);
  }

  function guardedRun(runId) {
    var run = store.get().aeroRuns.find(function (item) { return item.id === runId; });
    run = window.AeroHarness.normalize(run);
    if (!run) throw new Error("This change set is no longer available.");
    if (!run.flow || run.flow.mode !== "enforce" || !run.flowDecision || !run.flowDecision.ok) {
      throw new Error("This request doesn’t authorize that change.");
    }
    if (window.AeroHarness.digestContract(run) !== run.contractDigest) throw new Error("The plan changed after it was prepared.");
    return run;
  }

  function serverKind(actions) {
    var memory = actions.filter(function (action) { return action.type.indexOf("memory_") === 0; }).length;
    if (!memory) return "workspace";
    if (memory === actions.length) return "memory";
    return "mixed";
  }

  function memoryOperations(actions) {
    return actions.map(function (action) {
      if (action.type === "memory_forget") return { type: "forget", query: action.query || action.claim || "" };
      return {
        type: "remember",
        claim: action.claim || "",
        memoryType: action.memoryType || "semantic",
        scope: action.scope || "global",
        memoryKey: action.memoryKey || "",
        dependsOn: Array.isArray(action.dependsOn) ? action.dependsOn : [],
        supersedes: Array.isArray(action.supersedes) ? action.supersedes : [],
      };
    });
  }

  function requestKeyFor(runId, kind) {
    return ("altpsi-" + kind + "-" + runId).slice(0, 160);
  }

  function remoteId(binding) {
    return binding.kind === "memory" ? binding.transactionId : binding.runId;
  }

  function bindingFromPending(pending) {
    return {
      kind: pending.kind,
      runId: pending.kind === "workspace" ? pending.remoteId : "",
      transactionId: pending.kind === "memory" ? pending.remoteId : "",
      requestKey: pending.requestKey,
      contractDigest: pending.contractDigest,
      targetDigest: pending.targetDigest,
      baseRevision: pending.baseRevision,
      presenceRequired: pending.presenceRequired,
    };
  }

  function awaitingOutcome(phase) {
    return phase === "committing" || phase === "uncertain";
  }

  function findRun(runId) {
    return store.get().aeroRuns.find(function (item) { return item.id === runId; }) || null;
  }

  function diagnosticRun(pending) {
    // A detached receipt has no title, prompt, body, or claim to recover
    // from the device journal. Preserve only the known operation types.
    var original = findRun(pending.localRunId);
    if (original && original.contractDigest === pending.localContractDigest) return original;
    return minimalRun(pending);
  }

  function minimalRun(pending) {
    return window.AeroHarness.normalize({
      id: pending.localRunId,
      intent: pending.kind === "memory" ? "Aero memory change" : "Aero workspace change",
      contractDigest: pending.localContractDigest,
      status: "awaiting-approval",
      steps: pending.stepTypes.map(function (type, index) {
        return { id: pending.localRunId + ":" + index, action: { type: type }, status: "proposed" };
      }),
      createdAt: pending.preparedAt,
      updatedAt: pending.updatedAt,
    });
  }

  function outcomeUncertain(runId) {
    var error = new Error("Check the previous change’s status before approving again.");
    error.code = "outcome_uncertain";
    error.runId = runId;
    return error;
  }

  function ensureSettledLane(owner, kind) {
    var unresolved = readPending(owner).find(function (entry) { return entry.kind === kind && awaitingOutcome(entry.phase); });
    if (unresolved) throw outcomeUncertain(unresolved.localRunId);
  }

  function inspectionMatches(pending, inspection) {
    if (!inspection || inspection.ok !== true || inspection.journalValid !== true || inspection.payloadValid !== true) return false;
    var id = pending.kind === "memory" ? inspection.transactionId : inspection.runId;
    var base = pending.kind === "memory" ? inspection.baseRevision : inspection.baseRev;
    return id === pending.remoteId && inspection.requestKey === pending.requestKey
      && inspection.contractDigest === pending.contractDigest && inspection.targetDigest === pending.targetDigest
      && base === pending.baseRevision
      && Array.isArray(inspection.review) && inspection.review.length === pending.stepTypes.length
      && inspection.review.every(function (step, index) { return step.type === pending.stepTypes[index]; });
  }

  async function inspectPending(pending, owner) {
    requireAccount(owner);
    var cloud = window.LyfeCloud;
    var inspection = pending.kind === "memory"
      ? await cloud.inspectAeroMemory(pending.remoteId)
      : await cloud.inspectAeroRun(pending.remoteId);
    requireAccount(owner);
    return inspection;
  }

  async function prepare(runId, owner) {
    var run = guardedRun(runId);
    if (run.status !== "awaiting-approval") throw new Error("This plan is closed.");
    if (!owner) return { run: run, authority: "local", review: run.steps };

    var actions = run.steps.map(function (step) { return step.action; });
    var kind = serverKind(actions);
    if (kind === "mixed") throw new Error("Review memory and workspace changes separately.");
    if (actions.length > 8) throw new Error("Review up to eight account changes at a time.");
    ensureSettledLane(owner, kind);

    var pending = pendingFor(runId, owner);
    var liveBinding = serverBindings.get(runId);
    if (liveBinding && liveBinding.owner === owner && liveBinding.localContractDigest === run.contractDigest
      && liveBinding.approvalExpiresAt > Date.now() && pending && pending.phase === "prepared") {
      return { run: run, authority: "server", review: liveBinding.review, presenceRequired: liveBinding.presenceRequired };
    }

    if (pending) {
      if (pending.phase !== "prepared" || pending.localContractDigest !== run.contractDigest) {
        throw new Error("This plan is closed. Open its activity to see the outcome.");
      }
      var inspection = await inspectPending(pending, owner);
      if (!inspectionMatches(pending, inspection)) {
        throw new Error("Aero couldn’t match this review to its account record.");
      }
      if (inspection.status !== "prepared") {
        return { result: await reconcileRun(runId, owner) };
      }
    }

    var cloud = window.LyfeCloud;
    var requestKey = pending ? pending.requestKey : requestKeyFor(runId, kind);
    var prepared;
    if (kind === "memory") {
      if (!cloud.aeroMemoryEnabled) throw new Error("Protected account memory is unavailable.");
      prepared = await cloud.prepareAeroMemory({ requestKey: requestKey, operations: memoryOperations(actions) });
    } else {
      if (!cloud.aeroExecutionEnabled) throw new Error("Protected account actions are unavailable.");
      if (!pending && !(await store.flushWorkspace())) {
        throw new Error("The workspace could not sync. Reload before reviewing this plan.");
      }
      requireAccount(owner);
      prepared = await cloud.prepareAeroRun({ requestKey: requestKey, intent: run.intent, actions: actions });
    }
    requireAccount(owner);

    if (prepared && prepared.ok === true && prepared.status === "noop" && kind === "memory" && !pending) {
      var unchanged = window.AeroHarness.cancel(run);
      replaceRun(unchanged);
      store.cache("memory-noop");
      return { result: { run: unchanged, authoritative: true, noop: true, applied: 0, failures: [] } };
    }

    var binding = {
      kind: kind,
      owner: owner,
      requestKey: requestKey,
      runId: prepared && prepared.runId,
      transactionId: prepared && prepared.transactionId,
      contractDigest: prepared && prepared.contractDigest,
      targetDigest: prepared && prepared.targetDigest,
      baseRevision: prepared && (kind === "memory" ? prepared.baseRevision : prepared.baseRev),
      approvalToken: prepared && prepared.approvalToken,
      approvalExpiresAt: Date.parse(prepared && prepared.approvalExpiresAt),
      presenceRequired: !!(prepared && prepared.presenceRequired === true),
      review: prepared && prepared.review,
      localContractDigest: run.contractDigest,
    };
    if (!prepared || prepared.ok !== true || prepared.status !== "prepared" || !UUID_RE.test(remoteId(binding))
      || !HEX_DIGEST_RE.test(binding.contractDigest) || !HEX_DIGEST_RE.test(binding.targetDigest)
      || !Number.isSafeInteger(binding.baseRevision) || binding.baseRevision < 0
      || typeof binding.approvalToken !== "string" || binding.approvalToken.length < 32
      || !Number.isFinite(binding.approvalExpiresAt)
      || !Array.isArray(binding.review) || binding.review.length !== run.steps.length
      || !binding.review.every(function (step, index) { return step.type === actions[index].type; })) {
      throw new Error("Aero couldn’t prepare a verified review.");
    }
    if (pending && (pending.remoteId !== remoteId(binding) || pending.contractDigest !== binding.contractDigest
      || pending.targetDigest !== binding.targetDigest || pending.baseRevision !== binding.baseRevision)) {
      throw new Error("The server returned a different plan. Open a fresh review.");
    }
    rememberPending(run, binding, owner, "prepared");
    serverBindings.set(runId, binding);
    return { run: run, authority: "server", review: binding.review, presenceRequired: binding.presenceRequired };
  }

  function checkCompletion(binding, committed, inspection) {
    var memory = binding.kind === "memory";
    var certificate = committed && committed.certificate;
    var payload = certificate && certificate.payload;
    var id = memory ? "transactionId" : "runId";
    var base = memory ? "baseRevision" : "baseRev";
    var after = memory ? "newRevision" : "newRev";
    var revision = committed && (memory ? committed.revision : committed.rev);
    if (!payload || !HEX_DIGEST_RE.test(certificate.digest) || !HEX_DIGEST_RE.test(payload.eventHeadDigest)
      || !HEX_DIGEST_RE.test(payload.beforeDigest)
      || payload[id] !== remoteId(binding) || payload.status !== "completed" || payload.atomic !== true
      || payload.contractDigest !== binding.contractDigest || payload.targetDigest !== binding.targetDigest
      || payload[base] !== binding.baseRevision || payload[after] !== binding.baseRevision + 1
      || (binding.presenceRequired && !(payload.presence && payload.presence.required === true && payload.presence.verified === true))
      || !Number.isSafeInteger(revision) || revision < payload[after]
      || !committed.state || typeof committed.state !== "object" || Array.isArray(committed.state)) {
      throw proofError("The completion proof doesn’t match the reviewed plan.");
    }

    if (!inspection && revision !== payload[after]) throw proofError("The commit returned an unexpected revision.");
    if (revision === payload[after] && rawDigest(committed.state) !== binding.targetDigest) {
      throw proofError("The committed state doesn’t match the reviewed target.");
    }
    if (!inspection) return "commit";

    // The deployed inspect RPC already validates the ordered journal. Use its
    // committed event as evidence, including when the certificate checksum
    // flag isn't available on an older deployment.
    var events = inspection.events;
    var completed = Array.isArray(events) ? events.filter(function (entry) { return entry.type === "completed"; }) : [];
    var event = completed.length === 1 ? completed[0].payload : null;
    var head = Array.isArray(events) && events[events.length - 1];
    if (inspection.status !== "completed" || inspection.certificateValid === false
      || payload.eventHeadDigest !== inspection.eventHeadDigest || !head
      || head.digest !== payload.eventHeadDigest || head.sequence !== inspection.eventSequence
      || !event || event.atomic !== true || event[after] !== payload[after]
      || event.contractDigest !== binding.contractDigest || event.targetDigest !== binding.targetDigest) {
      throw proofError("The server journal doesn’t establish completion.");
    }
    return inspection.certificateValid === true ? "certificate" : "journal";
  }

  function terminalRun(source, entry, phase, receipt, certificate) {
    var completed = phase === "completed";
    var run = entry.kind === "memory" ? minimalRun(entry) : window.AeroHarness.normalize(source);
    run.status = completed ? "completed" : phase === "cancelled" ? "cancelled" : "failed";
    run.transaction.state = completed ? "committed" : phase;
    run.updatedAt = Date.now();
    run.steps.forEach(function (step) {
      step.status = completed ? "succeeded" : "cancelled";
      step.finishedAt = run.updatedAt;
    });
    if (completed) {
      run.checkpoint = { nextStep: run.steps.length, completedKeys: run.steps.map(function (step) { return step.idempotencyKey; }) };
      run.transaction.appliedStepIds = run.steps.map(function (step) { return step.id; });
      run.taskState.unmetStepIds = [];
    }
    run.failure = phase === "stale" || phase === "expired" ? {
      code: "REMOTE_" + phase.toUpperCase(),
      message: phase === "stale" ? "The account changed before this plan could apply." : "The review expired before it could apply.",
      phase: "recovery",
      at: run.updatedAt,
    } : null;
    run.remote = {
      kind: entry.kind, id: entry.remoteId, contractDigest: entry.contractDigest, targetDigest: entry.targetDigest,
      phase: phase, recovered: receipt.recovered, preparedAt: entry.preparedAt, updatedAt: run.updatedAt,
    };
    run.serverReceipt = receipt;
    run.serverCertificate = certificate || null;
    return run;
  }

  async function settle(source, entry, owner, phase, evidence) {
    requireAccount(owner);
    var completed = phase === "completed";
    var receipt = {
      completed: completed ? entry.stepTypes.length : 0,
      total: entry.stepTypes.length,
      atomic: true,
      certified: completed,
      recovered: evidence.recovered,
      stopped: !completed,
      proof: evidence.proof || "journal",
    };
    var run = terminalRun(source, entry, phase, receipt, evidence.certificate);
    setPendingPhase(source.id, owner, phase, "");
    serverBindings.delete(source.id);
    replaceRun(run);
    store.cache("server-settled");
    var synced = false;
    try {
      synced = await store.syncRunReceipt(run, owner, evidence.minimumWorkspaceRevision || 0, evidence.workspace);
      if (synced) forgetPending(source.id, owner);
    } catch (error) { /* an authoritative effect does not depend on mirroring its receipt */ }
    return {
      run: run, authoritative: true, recovered: evidence.recovered, receiptSynced: synced,
      applied: receipt.completed, status: phase, failures: run.failure ? [run.failure.message] : [], receipt: receipt,
    };
  }

  async function finishCompletion(source, entry, owner, committed, inspection, before) {
    requireAccount(owner);
    var proof = checkCompletion(bindingFromPending(entry), committed, inspection);
    var workspace = null;
    if (entry.kind === "memory") {
      var currentMemoryRevision = Number(store.get().aero && store.get().aero.memoryRevision || 0);
      if (committed.revision >= currentMemoryRevision) store.get().aero = window.AeroCore.normalize(committed.state);
    } else {
      workspace = { data: committed.state, rev: committed.rev };
      store.adoptWorkspace(workspace, before, owner);
    }
    var reference = findRun(source.id) || source;
    var newlyVerified = !(reference.remote && reference.remote.phase === "completed");
    if (newlyVerified && entry.kind === "workspace" && source.episodeId && window.AeroCore) {
      var data = store.get();
      data.aero = window.AeroCore.observeOutcome(data.aero, source.episodeId, "accepted", {
        actionTypes: entry.stepTypes, execution: "server-atomic",
      });
    }
    return settle(source, entry, owner, "completed", {
      recovered: !!inspection || (reference.remote && reference.remote.recovered === true) || false,
      proof: proof,
      certificate: committed.certificate,
      workspace: workspace,
      minimumWorkspaceRevision: entry.kind === "workspace" ? entry.baseRevision + 1 : 0,
    });
  }

  function unknownResult(entry, owner, errorCode) {
    if (awaitingOutcome(entry.phase)) setPendingPhase(entry.localRunId, owner, "uncertain", errorCode);
    return { run: diagnosticRun(entry), authoritative: false, status: "uncertain", failures: [] };
  }

  async function fencePending(entry, owner) {
    requireAccount(owner);
    var cloud = window.LyfeCloud;
    if (entry.kind === "memory") {
      await cloud.cancelAeroMemory({ transactionId: entry.remoteId, contractDigest: entry.contractDigest });
    } else {
      await cloud.cancelAeroRun({ runId: entry.remoteId, contractDigest: entry.contractDigest });
    }
  }

  async function reconcileRun(runId, owner, cancelRequested) {
    var entry = pendingFor(runId, owner);
    if (!entry) return null;

    var wasDispatched = awaitingOutcome(entry.phase);
    if (cancelRequested && entry.phase === "prepared") {
      setPendingPhase(runId, owner, "uncertain", "");
      entry.phase = "uncertain";
    }
    if (cancelRequested || wasDispatched) {
      try { await fencePending(entry, owner); }
      catch (error) { /* the commit may have won the lock; inspect either way */ }
    }

    try {
      var inspection = await inspectPending(entry, owner);
      if (!inspectionMatches(entry, inspection)) return unknownResult(entry, owner, "inspection_mismatch");
      var run = diagnosticRun(entry);
      if (inspection.status === "completed") {
        var before = store.state.localVersion;
        var cloud = window.LyfeCloud;
        var committed;
        if (entry.kind === "memory") {
          var memory = await cloud.readAeroMemory();
          if (!memory) throw proofError("The current memory revision isn’t available.");
          committed = { state: memory.state, revision: memory.revision, certificate: inspection.certificate };
        } else {
          var remote = await cloud.pull({ track: false });
          if (!remote) throw proofError("The current workspace revision isn’t available.");
          committed = { state: remote.data, rev: remote.rev, certificate: inspection.certificate };
        }
        return await finishCompletion(run, entry, owner, committed, inspection, before);
      }
      if (inspection.status === "cancelled" || inspection.status === "stale" || inspection.status === "expired") {
        var last = inspection.events && inspection.events[inspection.events.length - 1];
        if (!last || last.type !== inspection.status || last.digest !== inspection.eventHeadDigest) {
          return unknownResult(entry, owner, "terminal_event_missing");
        }
        return settle(run, entry, owner, inspection.status, { recovered: wasDispatched });
      }
      if (inspection.status === "prepared" && !wasDispatched && !cancelRequested && entry.phase === "prepared") {
        return { run: run, authoritative: false, status: "prepared" };
      }
      return unknownResult(entry, owner, "outcome_unsettled");
    } catch (error) {
      requireAccount(owner);
      return unknownResult(entry, owner, error && error.code || "inspection_unavailable");
    }
  }

  async function reconcilePending(owner) {
    if (!owner) return [];
    var entries = readPending(owner).filter(function (entry) { return entry.phase !== "prepared"; });
    // A later browser retry or manual check can pick up the remaining entries.
    // This also avoids exhausting the protected endpoint's request budget.
    entries.sort(function (left, right) {
      return Number(awaitingOutcome(right.phase)) - Number(awaitingOutcome(left.phase)) || left.updatedAt - right.updatedAt;
    });
    var results = [];
    for (var index = 0; index < Math.min(entries.length, 4); index++) {
      results.push(await reconcileRun(entries[index].localRunId, owner));
    }
    return results;
  }

  async function execute(runId, owner) {
    if (owner) {
      var pending = pendingFor(runId, owner);
      if (pending && pending.phase !== "prepared") {
        var prior = await reconcileRun(runId, owner);
        if (prior && prior.authoritative) return prior;
        throw outcomeUncertain(runId);
      }
    }

    var source = guardedRun(runId);
    if (source.status !== "awaiting-approval") throw new Error("This plan is closed.");
    if (owner) {
      var binding = serverBindings.get(runId);
      if (!binding || binding.owner !== owner || !pending || binding.localContractDigest !== source.contractDigest) {
        throw new Error("Open the plan’s review again before approving.");
      }
      ensureSettledLane(owner, binding.kind);
      if (binding.approvalExpiresAt <= Date.now()) {
        var expired = new Error("This review expired. Review it again to apply.");
        expired.code = "review_expired";
        throw expired;
      }

      var cloud = window.LyfeCloud;
      var presenceToken = "";
      if (binding.presenceRequired) {
        var presence = await cloud.approveAeroPresence({
          targetType: binding.kind === "memory" ? "memory" : "run",
          targetId: remoteId(binding),
          contractDigest: binding.contractDigest,
          approvalToken: binding.approvalToken,
        });
        requireAccount(owner);
        presenceToken = String(presence && presence.presenceToken || "");
        if (!presenceToken) throw new Error("Device verification is required to apply this plan.");
      }

      var entry = rememberPending(source, binding, owner, "committing");
      var before = store.state.localVersion;
      try {
        var payload = { contractDigest: binding.contractDigest, approvalToken: binding.approvalToken, presenceToken: presenceToken };
        var committed;
        if (binding.kind === "memory") {
          payload.transactionId = binding.transactionId;
          committed = await cloud.commitAeroMemory(payload);
        } else {
          payload.runId = binding.runId;
          committed = await cloud.commitAeroRun(payload, { track: false });
        }
        return await finishCompletion(source, entry, owner, committed, null, before);
      } catch (error) {
        setPendingPhase(runId, owner, "uncertain", error && error.code || "commit_response_lost");
        requireAccount(owner);
        var settled = await reconcileRun(runId, owner);
        if (settled && settled.authoritative) return settled;
        throw outcomeUncertain(runId);
      }
    }

    var approved = window.AeroHarness.approve(source);
    replaceRun(approved);
    if (approved.status !== "approved") {
      store.save("aero-blocked", true);
      return { run: approved, applied: 0, failures: [approved.failure && approved.failure.message || "The plan could not be approved."] };
    }
    var result = window.AeroHarness.executeApproved(approved, {
      execute: function (action) { return store.applyAction(action); },
      audit: function (contract, applied) { return store.audit(contract.action, applied); },
      compensate: function (action, applied) { return store.compensate(action, applied); },
    });
    replaceRun(result.run);
    if (result.run.episodeId && window.AeroCore) {
      var data = store.get();
      data.aero = window.AeroCore.observeOutcome(data.aero, result.run.episodeId, result.run.status === "completed" ? "accepted" : "missed", {
        actionTypes: result.run.steps.map(function (step) { return step.action.type; }),
        firstPass: result.run.status === "completed",
      });
    }
    store.save(result.run.status === "completed" ? "aero-complete" : "aero-failed", true);
    return result;
  }

  async function cancel(runId, owner) {
    var pending = pendingFor(runId, owner);
    if (pending) {
      var settled = await reconcileRun(runId, owner, true);
      if (settled && settled.authoritative) return settled.run;
      throw outcomeUncertain(runId);
    }
    var source = findRun(runId);
    if (!source || source.status !== "awaiting-approval") return source;
    var cancelled = window.AeroHarness.cancel(source);
    replaceRun(cancelled);
    var data = store.get();
    if (cancelled.episodeId && window.AeroCore) {
      data.aero = window.AeroCore.observeOutcome(data.aero, cancelled.episodeId, "rejected", {
        actionTypes: cancelled.steps.map(function (step) { return step.action.type; }),
      });
    }
    store.cache("aero-cancel");
    return cancelled;
  }

  function contextSummary() {
    var data = store.get();
    var settings = data.settings.aeroSources || {};
    var connect = store.getConnect && store.getConnect();
    var gmail = store.getGmail && store.getGmail() || [];
    var peopleCount = connect && typeof connect === "object"
      ? [connect.conversations, connect.contacts, connect.profiles, connect.notifications].reduce(function (sum, items) { return sum + (Array.isArray(items) ? items.length : 0); }, 0)
      : 0;
    var memoryCount = data.aero && Array.isArray(data.aero.memories)
      ? data.aero.memories.filter(function (item) { return item.status === "active" || item.status === "provisional"; }).length
      : 0;
    var knowledgeCount = window.AeroKnowledge ? Number(window.AeroKnowledge.stats().records || 0) : 0;
    var sources = [
      { key: "tracking", label: "Work", count: data.tasks.length + data.projects.length + data.goals.length },
      { key: "library", label: "Files", count: data.notes.length + data.docs.length + data.saved.length + knowledgeCount },
      { key: "gmail", label: "Mail", count: gmail.length, available: !!(window.LyfeCloud && window.LyfeCloud.gmailToken) },
      { key: "connect", label: "People", count: peopleCount, available: !!connect },
      { key: "knowledge", label: "Memory", count: memoryCount, available: memoryCount > 0 },
      { key: "profile", label: "Profile", count: data.settings.name ? 1 : 0, available: !!data.settings.name },
    ].filter(function (source) { return settings[source.key] !== false && source.available !== false; });
    return { sources: sources, count: sources.length, items: sources.reduce(function (sum, source) { return sum + source.count; }, 0) };
  }

  window.AeroService = {
    parseActions: parseActions,
    propose: propose,
    proposeActions: proposeActions,
    prepare: function (runId) { return withAccountOperation(function (owner) { return prepare(runId, owner); }); },
    execute: function (runId) { return withAccountOperation(function (owner) { return execute(runId, owner); }); },
    cancel: function (runId) { return withAccountOperation(function (owner) { return cancel(runId, owner); }); },
    reconcileRun: function (runId) { return withAccountOperation(function (owner) { return reconcileRun(runId, owner); }); },
    reconcilePending: function () { return withAccountOperation(reconcilePending); },
    recoveryState: recoveryState,
    findRun: function (runId) {
      var pending = pendingFor(runId);
      return pending ? diagnosticRun(pending) : findRun(runId);
    },
    pendingRuns: function () {
      return readPending(currentAccount()).filter(function (entry) { return awaitingOutcome(entry.phase); }).map(diagnosticRun);
    },
    contextSummary: contextSummary,
    topTasks: topTasks,
    localAnswer: localAnswer,
  };
})();
