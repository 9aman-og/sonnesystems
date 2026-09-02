(function () {
  "use strict";

  var store = window.AeroStore;
  var serverBindings = new Map();

  function clean(value, max) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 2000);
  }

  function isoDate(offset) {
    var date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + Number(offset || 0));
    return date.toISOString().slice(0, 10);
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

    match = text.match(/^(?:please\s+)?(?:remind\s+me(?:\s+to)?|remember\s+to|(?:add|create|make)\s+(?:a\s+)?(?:task|todo)|task\s*:|todo\s*:|i\s+(?:need|have)\s+to|i\s+gotta\s+to?)\s+(.+)$/i);
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

  function parseActions(request) {
    var text = clean(request);
    var parts = text.split(/\s+(?:and then|then|also)\s+|[;\n]+/i).map(clean).filter(Boolean).slice(0, 12);
    var actions = parts.map(parseSingle).filter(Boolean);
    if (actions.length !== parts.length) {
      var single = parseSingle(text);
      return single ? [single] : [];
    }
    return actions;
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
    var thread = store.activeThread();
    var episode = window.AeroCore.beginEpisode(data.aero, text, "aero", thread.id);
    data.aero = episode.aero;
    store.appendMessage("user", text, {
      episodeId: episode.episode.id,
      attachments: (Array.isArray(attachments) ? attachments : []).slice(0, 12).map(function (item) { return { id: item.id, name: item.name, type: item.type, size: item.size, localOnly: true }; }),
    });

    var plan = window.AeroCore.routePlan({ signal: text, engines: { ollama: false, groq: false, gpt: false, gemini: false }, cloudAllowed: false });
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
    var actions = parseActions(text);

    if (!actions.length || decision.mode === "clarify") {
      var answer = localAnswer(text, data, decision, context);
      data.aero = window.AeroCore.finishEpisode(data.aero, episode.episode.id, decision.mode === "clarify" ? "missed" : "answered", { route: plan.engine, actionTypes: [] });
      store.appendMessage("assistant", answer, { episodeId: episode.episode.id });
      store.save("aero-answer");
      return { kind: "answer", answer: answer, plan: plan, decision: decision, episodeId: episode.episode.id, context: context };
    }

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
    store.save("aero-proposal", true);
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
    store.save("aero-proposal", true);
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
    if (!run.flowDecision || !run.flowDecision.ok) throw new Error("The source does not authorize this change.");
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
      if (action.type === "memory_forget") return { type: action.type, query: action.query || action.claim || "" };
      return {
        type: action.type,
        claim: action.claim || "",
        memoryType: action.memoryType || "semantic",
        scope: action.scope || "global",
        memoryKey: action.memoryKey || "",
        dependsOn: Array.isArray(action.dependsOn) ? action.dependsOn : [],
        supersedes: Array.isArray(action.supersedes) ? action.supersedes : [],
      };
    });
  }

  async function prepare(runId) {
    var run = guardedRun(runId);
    if (!(store.state.cloudMode && window.LyfeCloud && window.LyfeCloud.user)) return { run: run, authority: "local", kind: "workspace", review: run.steps };
    var actions = run.steps.map(function (step) { return step.action; });
    var kind = serverKind(actions);
    if (kind === "mixed") throw new Error("Memory and workspace changes must be reviewed separately.");
    var prepared;
    if (kind === "memory") {
      if (!window.LyfeCloud.aeroMemoryEnabled) throw new Error("Protected account memory is unavailable. Nothing changed.");
      prepared = await window.LyfeCloud.prepareAeroMemory({
        requestKey: ("aero-memory-" + run.id + "-r" + Number(store.get().aero && store.get().aero.memoryRevision || 0)).slice(0, 160),
        operations: memoryOperations(actions),
      });
    } else {
      if (!window.LyfeCloud.aeroExecutionEnabled) throw new Error("Protected account actions are unavailable. Nothing changed.");
      if (typeof window.LyfeCloud.flush === "function") {
        var flushed = await window.LyfeCloud.flush(store.get(), store.get().rev);
        if (flushed === false) throw new Error("This workspace changed in another session. Open the plan again.");
      }
      prepared = await window.LyfeCloud.prepareAeroRun({
        requestKey: ("aero-" + run.id + "-r" + Number(store.get().rev || 0)).slice(0, 160),
        intent: run.intent,
        actions: actions,
      });
    }
    if (!(prepared && prepared.contractDigest && prepared.approvalToken)) throw new Error("The protected review could not be bound. Nothing changed.");
    var binding = {
      kind: kind,
      runId: prepared.runId,
      transactionId: prepared.transactionId,
      contractDigest: prepared.contractDigest,
      approvalToken: prepared.approvalToken,
      presenceRequired: prepared.presenceRequired === true,
      review: Array.isArray(prepared.review) ? prepared.review : [],
      localContractDigest: run.contractDigest,
    };
    serverBindings.set(run.id, binding);
    return { run: run, authority: "server", kind: kind, review: binding.review, presenceRequired: binding.presenceRequired };
  }

  function completedDisplayRun(source, certificate) {
    var run = window.AeroHarness.normalize(source);
    run.status = "completed";
    run.transaction.state = "committed";
    run.steps.forEach(function (step) {
      step.status = "succeeded";
      step.finishedAt = Date.now();
    });
    run.serverCertificate = certificate || null;
    run.updatedAt = Date.now();
    return run;
  }

  async function execute(runId) {
    var data = store.get();
    var source = guardedRun(runId);
    if (store.state.cloudMode && window.LyfeCloud && window.LyfeCloud.user) {
      var binding = serverBindings.get(runId);
      if (!binding) {
        await prepare(runId);
        binding = serverBindings.get(runId);
      }
      if (!binding || binding.localContractDigest !== source.contractDigest) throw new Error("The approved plan no longer matches this account revision.");
      var presenceToken = "";
      if (binding.presenceRequired) {
        var presence = await window.LyfeCloud.approveAeroPresence({
          targetType: binding.kind === "memory" ? "memory" : "run",
          targetId: binding.kind === "memory" ? binding.transactionId : binding.runId,
          contractDigest: binding.contractDigest,
          approvalToken: binding.approvalToken,
        });
        presenceToken = String(presence && presence.presenceToken || "");
        if (!presenceToken) throw new Error("This device did not approve the exact plan. Nothing changed.");
      }
      var committed;
      if (binding.kind === "memory") {
        committed = await window.LyfeCloud.commitAeroMemory({
          transactionId: binding.transactionId,
          contractDigest: binding.contractDigest,
          approvalToken: binding.approvalToken,
          presenceToken: presenceToken,
        });
        if (!(committed && committed.state && committed.certificate)) throw new Error("The memory transaction returned no completion proof.");
        var withMemory = store.clone(data);
        withMemory.aero = window.AeroCore.normalize(committed.state);
        store.adopt(withMemory, data.rev, "server-memory");
      } else {
        committed = await window.LyfeCloud.commitAeroRun({
          runId: binding.runId,
          contractDigest: binding.contractDigest,
          approvalToken: binding.approvalToken,
          presenceToken: presenceToken,
        });
        if (!(committed && committed.state && committed.certificate && Number.isFinite(Number(committed.rev)))) throw new Error("The account transaction returned no completion proof.");
        store.adopt(committed.state, Number(committed.rev), "server-workspace");
      }
      serverBindings.delete(runId);
      data = store.get();
      var displayRun = completedDisplayRun(source, committed.certificate);
      replaceRun(displayRun);
      if (displayRun.episodeId && window.AeroCore) {
        data.aero = window.AeroCore.observeOutcome(data.aero, displayRun.episodeId, "accepted", { actionTypes: displayRun.steps.map(function (step) { return step.action.type; }), execution: "server-atomic" });
      }
      store.save("server-receipt", true);
      return {
        run: displayRun,
        authoritative: true,
        applied: displayRun.steps.length,
        failures: [],
        certificate: committed.certificate,
        receipt: { completed: displayRun.steps.length, total: displayRun.steps.length, evidence: displayRun.steps.length, atomic: true, certified: true },
      };
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
      data.aero = window.AeroCore.observeOutcome(data.aero, result.run.episodeId, result.run.status === "completed" ? "accepted" : "missed", { actionTypes: result.run.steps.map(function (step) { return step.action.type; }), firstPass: result.run.status === "completed" });
    }
    store.save(result.run.status === "completed" ? "aero-complete" : "aero-failed", true);
    return result;
  }

  async function cancel(runId) {
    var data = store.get();
    var source = data.aeroRuns.find(function (run) { return run.id === runId; });
    if (!source) return null;
    var cancelled = window.AeroHarness.cancel(source);
    var binding = serverBindings.get(runId);
    if (binding && window.LyfeCloud) {
      serverBindings.delete(runId);
      try {
        if (binding.kind === "memory") await window.LyfeCloud.cancelAeroMemory({ transactionId: binding.transactionId, contractDigest: binding.contractDigest });
        else await window.LyfeCloud.cancelAeroRun({ runId: binding.runId, contractDigest: binding.contractDigest });
      } catch (error) { /* protected plans expire without applying */ }
    }
    replaceRun(cancelled);
    if (cancelled.episodeId && window.AeroCore) data.aero = window.AeroCore.observeOutcome(data.aero, cancelled.episodeId, "rejected", { actionTypes: cancelled.steps.map(function (step) { return step.action.type; }) });
    store.save("aero-cancel", true);
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
    prepare: prepare,
    execute: execute,
    cancel: cancel,
    contextSummary: contextSummary,
    topTasks: topTasks,
    localAnswer: localAnswer,
  };
})();
