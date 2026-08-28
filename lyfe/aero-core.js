/* ============================================================
   Aero Core v0.2
   Clean-room, local-first product intelligence for Lyfe.

   This module contains no EOS, IISc, or unpublished research code. It is a
   small auditable layer for bounded context, typed user-controlled memory,
   action validation, and communication-compression evaluation.
   ============================================================ */
(function () {
  "use strict";

  var VERSION = "aero-core-v0.2";
  var MEMORY_TYPES = ["episodic", "semantic", "project", "procedural"];
  var MEMORY_STATUSES = ["candidate", "provisional", "active", "disputed", "superseded", "invalidated"];
  var MAX_MEMORIES = 300;
  var MAX_MEMORY_TRANSACTIONS = 120;
  var ACTION_TYPES = [
    "add_task", "complete_task", "add_note", "add_doc", "log_work",
    "add_goal", "add_education", "add_project", "memory_upsert", "memory_forget"
  ];

  function id(prefix) {
    try { return prefix + "_" + crypto.randomUUID(); }
    catch (error) { return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
  }

  function text(value, max) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 500);
  }

  function list(value) { return Array.isArray(value) ? value : []; }

  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce(function (out, key) {
      if (value[key] !== undefined) out[key] = canonical(value[key]);
      return out;
    }, {});
  }

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  /* This journal fingerprint detects accidental corruption. It is not an
     authorization signature; user authority remains in the action harness. */
  function fingerprint(value) {
    var input = JSON.stringify(canonical(value));
    var hash = 2166136261;
    for (var index = 0; index < input.length; index++) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return "fnv1a-" + (hash >>> 0).toString(16).padStart(8, "0");
  }

  function normalizeSourceRef(source) {
    if (!source || typeof source !== "object") return null;
    var result = {
      kind: text(source.kind, 60), id: text(source.id, 120),
      label: text(source.label, 160), at: Number(source.at || 0),
    };
    return result.kind && result.id ? result : null;
  }

  function memoryKeyFor(candidate, claim) {
    candidate = candidate || {};
    var explicit = text(candidate.memoryKey || candidate.patternKey, 240).toLowerCase();
    if (explicit) return explicit;
    var type = MEMORY_TYPES.indexOf(candidate.type) >= 0 ? candidate.type : "semantic";
    var scope = text(candidate.scope, 100).toLowerCase() || "global";
    var normalizedClaim = text(claim, 800).toLowerCase();
    var slot = normalizedClaim.match(/^(?:my|the)\s+([\p{L}\p{N}][\p{L}\p{N}\s_-]{0,70}?)\s+(?:is|are|=)\s+.+$/u);
    if (slot) return type + "|" + scope + "|slot:" + slot[1].replace(/\s+/g, " ").trim();
    return type + "|" + scope + "|claim:" + normalizedClaim;
  }

  function normalizeMemory(memory) {
    if (!memory || typeof memory !== "object" || !text(memory.claim, 800)) return null;
    var createdAt = Number(memory.createdAt) || Date.now();
    return {
      id: text(memory.id, 100) || id("mem"),
      type: MEMORY_TYPES.indexOf(memory.type) >= 0 ? memory.type : "semantic",
      scope: text(memory.scope, 100) || "global",
      claim: text(memory.claim, 800),
      memoryKey: text(memory.memoryKey, 240).toLowerCase() || memoryKeyFor(memory, memory.claim),
      sourceMode: memory.sourceMode === "inferred" ? "inferred" : "explicit",
      status: MEMORY_STATUSES.indexOf(memory.status) >= 0 ? memory.status : "active",
      confidence: Math.max(0, Math.min(1, Number(memory.confidence == null ? 1 : memory.confidence))),
      evidence: list(memory.evidence).map(function (item) { return text(item, 120); }).filter(Boolean).slice(-12),
      sourceRefs: list(memory.sourceRefs).map(normalizeSourceRef).filter(Boolean).slice(-16),
      patternKey: text(memory.patternKey, 240),
      dependsOn: list(memory.dependsOn).map(function (value) { return text(value, 100); }).filter(Boolean).slice(-24),
      supersedes: list(memory.supersedes).map(function (value) { return text(value, 100); }).filter(Boolean).slice(-12),
      supersededBy: text(memory.supersededBy, 100),
      invalidatedBy: list(memory.invalidatedBy).map(function (value) { return text(value, 100); }).filter(Boolean).slice(-12),
      revision: Math.max(0, Number(memory.revision || 0)),
      commitId: text(memory.commitId, 120),
      validFrom: Number(memory.validFrom || createdAt),
      validUntil: Number(memory.validUntil || 0),
      successCount: Math.max(0, Number(memory.successCount) || 0),
      failureCount: Math.max(0, Number(memory.failureCount) || 0),
      distinctDays: list(memory.distinctDays).map(function (day) { return text(day, 10); }).filter(Boolean).slice(-30),
      lastUsed: Number(memory.lastUsed) || 0,
      lastConfirmed: Number(memory.lastConfirmed) || 0,
      contradictions: list(memory.contradictions).map(function (item) { return text(item, 160); }).filter(Boolean).slice(-12),
      episodeOutcomes: list(memory.episodeOutcomes).filter(function (item) {
        return item && typeof item === "object" && text(item.id, 100);
      }).slice(-50).map(function (item) {
        return { id: text(item.id, 100), polarity: item.polarity === "negative" ? "negative" : "positive", outcome: text(item.outcome, 30) };
      }),
      wasPromoted: memory.wasPromoted === true,
      createdAt: createdAt,
      updatedAt: Number(memory.updatedAt) || createdAt,
    };
  }

  function normalizeJournalImage(value) {
    if (!value || typeof value !== "object") return null;
    if (value.redacted === true) return { id: text(value.id, 100), redacted: true };
    return normalizeMemory(value);
  }

  function normalizeMemoryTransaction(transaction) {
    if (!transaction || typeof transaction !== "object") return null;
    return {
      id: text(transaction.id, 120) || id("mtx"),
      revision: Math.max(0, Number(transaction.revision || 0)),
      kind: text(transaction.kind, 60) || "update",
      status: ["committed", "reverted", "recovery-blocked"].indexOf(transaction.status) >= 0 ? transaction.status : "committed",
      reason: text(transaction.reason, 260),
      sourceRefs: list(transaction.sourceRefs).map(normalizeSourceRef).filter(Boolean).slice(-16),
      changes: list(transaction.changes).slice(0, 40).map(function (change) {
        return { memoryId: text(change && change.memoryId, 100), before: normalizeJournalImage(change && change.before), after: normalizeJournalImage(change && change.after) };
      }).filter(function (change) { return change.memoryId; }),
      reverts: text(transaction.reverts, 120),
      previousFingerprint: text(transaction.previousFingerprint, 80),
      reversible: transaction.reversible !== false,
      createdAt: Number(transaction.createdAt) || Date.now(),
      fingerprint: text(transaction.fingerprint, 80),
    };
  }

  function freshState() {
    return {
      version: 2,
      memories: [],
      memoryRevision: 0,
      memoryJournal: [],
      episodes: [],
      lastContext: null,
      createdAt: Date.now(),
    };
  }

  function normalize(raw) {
    var base = freshState();
    if (!raw || typeof raw !== "object") return base;
    base.memories = list(raw.memories).map(normalizeMemory).filter(Boolean).slice(-MAX_MEMORIES);
    base.memoryRevision = Math.max(0, Number(raw.memoryRevision || 0));
    base.memoryJournal = list(raw.memoryJournal).map(normalizeMemoryTransaction).filter(Boolean).slice(-MAX_MEMORY_TRANSACTIONS);
    base.episodes = list(raw.episodes).filter(function (episode) {
      return episode && typeof episode === "object" && text(episode.signal, 2000);
    }).slice(-500).map(function (episode) {
      return Object.assign({}, episode, {
        id: text(episode.id, 100) || id("ep"),
        signal: text(episode.signal, 2000),
        surface: text(episode.surface, 50) || "aero",
        family: text(episode.family, 50) || "general",
        wordCount: Math.max(1, Number(episode.wordCount) || 1),
        coldBaseline: Math.max(1, Number(episode.coldBaseline) || Number(episode.wordCount) || 1),
        createdAt: Number(episode.createdAt) || Date.now(),
      });
    });
    base.lastContext = raw.lastContext && typeof raw.lastContext === "object" ? raw.lastContext : null;
    base.createdAt = Number(raw.createdAt) || Date.now();
    return base;
  }

  function transactionPayload(transaction) {
    return {
      id: transaction.id, revision: transaction.revision, kind: transaction.kind,
      status: transaction.status, reason: transaction.reason,
      sourceRefs: transaction.sourceRefs, changes: transaction.changes,
      reverts: transaction.reverts, previousFingerprint: transaction.previousFingerprint,
      reversible: transaction.reversible,
      createdAt: transaction.createdAt,
    };
  }

  function rechainMemoryJournal(aero) {
    aero.memoryJournal.forEach(function (transaction, index) {
      transaction.previousFingerprint = index ? aero.memoryJournal[index - 1].fingerprint : "";
      transaction.fingerprint = fingerprint(transactionPayload(transaction));
    });
  }

  function verifyMemoryJournal(aero) {
    aero = normalize(aero);
    var invalid = [];
    aero.memoryJournal.forEach(function (transaction, index) {
      var previous = index ? aero.memoryJournal[index - 1] : null;
      var brokenContent = !transaction.fingerprint || transaction.fingerprint !== fingerprint(transactionPayload(transaction));
      var brokenOrder = previous && (transaction.revision <= previous.revision || transaction.previousFingerprint !== previous.fingerprint);
      if (brokenContent || brokenOrder) invalid.push(transaction.id);
    });
    if (aero.memoryJournal.length && aero.memoryJournal[aero.memoryJournal.length - 1].revision !== aero.memoryRevision) invalid.push("journal-head");
    return { valid: invalid.length === 0, invalidTransactionIds: invalid, transactions: aero.memoryJournal.length };
  }

  function defaultSourceRefs(candidate) {
    candidate = candidate || {};
    var refs = list(candidate.sourceRefs).map(normalizeSourceRef).filter(Boolean);
    if (!refs.length) {
      refs.push({
        kind: candidate.sourceMode === "inferred" ? "behavioral-outcome" : "user-explicit",
        id: text(candidate.sourceId, 120) || (candidate.sourceMode === "inferred" ? "inferred-signal" : "direct-teaching"),
        label: text(candidate.sourceLabel, 160) || (candidate.sourceMode === "inferred" ? "Observed outcome" : "Taught directly in Aero"),
        at: Number(candidate.sourceAt || Date.now()),
      });
    }
    return refs.slice(-16);
  }

  function rememberBefore(before, memory) {
    if (!memory || Object.prototype.hasOwnProperty.call(before, memory.id)) return;
    before[memory.id] = clone(memory);
  }

  function mergeUnique(left, right, limit) {
    var result = [];
    list(left).concat(list(right)).forEach(function (value) {
      var key = typeof value === "object" ? JSON.stringify(canonical(value)) : String(value);
      if (!result.some(function (item) { return (typeof item === "object" ? JSON.stringify(canonical(item)) : String(item)) === key; })) result.push(value);
    });
    return result.slice(-(limit || 16));
  }

  function dependencyProblems(aero, memoryId, dependsOn) {
    var problems = [];
    var byId = new Map(aero.memories.map(function (memory) { return [memory.id, memory]; }));
    function reachesTarget(startId, seen) {
      if (startId === memoryId) return true;
      if (seen.has(startId)) return false;
      seen.add(startId);
      var current = byId.get(startId);
      return !!current && current.dependsOn.some(function (dependencyId) { return reachesTarget(dependencyId, seen); });
    }
    list(dependsOn).forEach(function (dependencyId) {
      var dependency = byId.get(dependencyId);
      if (!dependency || ["active", "provisional"].indexOf(dependency.status) < 0 || reachesTarget(dependencyId, new Set())) {
        if (problems.indexOf(dependencyId) < 0) problems.push(dependencyId);
      }
    });
    return problems;
  }

  function hasNewerLiveDependent(aero, rootIds, revision) {
    var queue = list(rootIds).slice();
    var seen = new Set(queue);
    while (queue.length) {
      var rootId = queue.shift();
      for (var index = 0; index < aero.memories.length; index++) {
        var memory = aero.memories[index];
        if (["superseded", "invalidated"].indexOf(memory.status) >= 0 || memory.dependsOn.indexOf(rootId) < 0) continue;
        if (memory.revision > revision) return true;
        if (!seen.has(memory.id)) { seen.add(memory.id); queue.push(memory.id); }
      }
    }
    return false;
  }

  function invalidateDependents(aero, rootIds, before, reason) {
    var queue = list(rootIds).slice();
    var invalidated = [];
    while (queue.length) {
      var rootId = queue.shift();
      aero.memories.forEach(function (memory) {
        if (["superseded", "invalidated"].indexOf(memory.status) >= 0) return;
        if (memory.dependsOn.indexOf(rootId) < 0 || invalidated.indexOf(memory.id) >= 0) return;
        rememberBefore(before, memory);
        memory.status = "invalidated";
        memory.validUntil = Date.now();
        memory.invalidatedBy = mergeUnique(memory.invalidatedBy, [rootId], 12);
        memory.contradictions = mergeUnique(memory.contradictions, [text(reason, 160) || "A dependency changed."], 12);
        memory.updatedAt = Date.now();
        invalidated.push(memory.id);
        queue.push(memory.id);
      });
    }
    return invalidated;
  }

  function commitMemoryChanges(aero, input) {
    input = input || {};
    var before = input.before || {};
    var affectedIds = mergeUnique(Object.keys(before), input.affectedIds, 40);
    if (!affectedIds.length) return { aero: aero, transaction: null };
    var revision = Math.max(0, Number(aero.memoryRevision || 0)) + 1;
    var transactionId = id("mtx");
    var changes = affectedIds.map(function (memoryId) {
      var current = aero.memories.find(function (memory) { return memory.id === memoryId; });
      if (current) {
        current.revision = revision;
        current.commitId = transactionId;
      }
      return {
        memoryId: memoryId,
        before: Object.prototype.hasOwnProperty.call(before, memoryId) ? clone(before[memoryId]) : null,
        after: current ? clone(current) : null,
      };
    });
    list(input.redactBeforeIds).forEach(function (memoryId) {
      var change = changes.find(function (item) { return item.memoryId === memoryId; });
      if (change) change.before = { id: memoryId, redacted: true };
    });
    var transaction = {
      id: transactionId, revision: revision,
      kind: text(input.kind, 60) || "update", status: "committed",
      reason: text(input.reason, 260), sourceRefs: list(input.sourceRefs).map(normalizeSourceRef).filter(Boolean).slice(-16),
      changes: changes, reverts: text(input.reverts, 120),
      previousFingerprint: aero.memoryJournal.length ? aero.memoryJournal[aero.memoryJournal.length - 1].fingerprint : "",
      reversible: input.reversible !== false, createdAt: Date.now(), fingerprint: "",
    };
    transaction.fingerprint = fingerprint(transactionPayload(transaction));
    aero.memoryRevision = revision;
    aero.memoryJournal.push(transaction);
    aero.memoryJournal = aero.memoryJournal.slice(-MAX_MEMORY_TRANSACTIONS);
    aero.memories = aero.memories.slice(-MAX_MEMORIES);
    return { aero: aero, transaction: transaction };
  }

  function scrubForgottenFromJournal(aero, memoryIds) {
    var forgotten = new Set(memoryIds);
    aero.memoryJournal.forEach(function (transaction) {
      var changed = false;
      transaction.changes.forEach(function (change) {
        if (!forgotten.has(change.memoryId)) return;
        change.before = { id: change.memoryId, redacted: true };
        change.after = change.after ? { id: change.memoryId, redacted: true } : null;
        transaction.reversible = false;
        changed = true;
      });
      if (changed) transaction.fingerprint = fingerprint(transactionPayload(transaction));
    });
    rechainMemoryJournal(aero);
  }

  function recoverMemoryTransaction(aero, transactionId) {
    aero = normalize(aero);
    var transaction = aero.memoryJournal.find(function (item) { return item.id === transactionId; });
    if (!transaction) return { aero: aero, recovered: false, reason: "Memory transaction was not found", transaction: null };
    if (!verifyMemoryJournal(aero).valid) return { aero: aero, recovered: false, reason: "Memory journal integrity check failed", transaction: transaction };
    if (!transaction.reversible || transaction.changes.some(function (change) { return change.before && change.before.redacted; })) {
      return { aero: aero, recovered: false, reason: "This transaction contains a privacy deletion and cannot be restored", transaction: transaction };
    }
    var stale = transaction.changes.some(function (change) {
      var current = aero.memories.find(function (memory) { return memory.id === change.memoryId; });
      if (!change.after) return !!current;
      return !current || current.commitId !== transaction.id || current.revision !== transaction.revision;
    });
    if (!stale) stale = hasNewerLiveDependent(aero, transaction.changes.map(function (change) { return change.memoryId; }), transaction.revision);
    if (stale) return { aero: aero, recovered: false, reason: "A newer memory revision depends on this state", transaction: transaction };

    var beforeRecovery = {};
    var affected = [];
    transaction.changes.forEach(function (change) {
      var currentIndex = aero.memories.findIndex(function (memory) { return memory.id === change.memoryId; });
      if (currentIndex >= 0) beforeRecovery[change.memoryId] = clone(aero.memories[currentIndex]);
      else beforeRecovery[change.memoryId] = null;
      if (change.before) {
        var restored = normalizeMemory(change.before);
        if (currentIndex >= 0) aero.memories[currentIndex] = restored;
        else aero.memories.push(restored);
      } else if (currentIndex >= 0) {
        aero.memories.splice(currentIndex, 1);
      }
      affected.push(change.memoryId);
    });
    transaction.status = "reverted";
    rechainMemoryJournal(aero);
    var committed = commitMemoryChanges(aero, {
      kind: "recovery", reason: "Reverted memory transaction " + transaction.id,
      before: beforeRecovery, affectedIds: affected,
      sourceRefs: [{ kind: "memory-recovery", id: transaction.id, label: "User-visible rollback", at: Date.now() }],
      reverts: transaction.id,
    });
    return { aero: committed.aero, recovered: true, reason: "Memory transaction restored", transaction: committed.transaction };
  }

  function activeItems(items, limit, titleKey, detailKey) {
    return list(items).slice(0, limit).map(function (item) {
      return {
        id: text(item.id, 100),
        title: text(item[titleKey] || item.title || item.name, 180),
        detail: text(detailKey ? item[detailKey] : "", 260),
      };
    }).filter(function (item) { return item.title; });
  }

  function addSource(sources, enabled, idValue, label, detail, items, privacy) {
    if (!enabled) return;
    sources.push({
      id: idValue,
      label: label,
      detail: text(detail, 260),
      items: list(items).slice(0, 12),
      privacy: privacy || "private",
    });
  }

  function contextPack(input) {
    input = input || {};
    var lyfe = input.lyfe || {};
    var settings = lyfe.settings || {};
    var sourcePolicy = input.sourcePolicy || {};
    var surface = text(input.surface, 50) || "aero";
    var today = new Date().toISOString().slice(0, 10);
    var openTasks = list(lyfe.tasks).filter(function (task) { return task.status !== "done"; });
    var overdue = openTasks.filter(function (task) { return task.due && task.due < today; });
    var dueToday = openTasks.filter(function (task) { return task.due === today; });
    var activeProjects = list(lyfe.projects).filter(function (project) { return project.status === "active"; });
    var sources = [];

    addSource(sources, sourcePolicy.today !== false, "today", "Today",
      openTasks.length + " open · " + dueToday.length + " due today · " + overdue.length + " overdue",
      activeItems(overdue.concat(dueToday).concat(openTasks).slice(0, 8), 8, "title", "notes"));

    addSource(sources, sourcePolicy.tracking !== false, "tracking", "Tracking",
      activeProjects.length + " active projects · " + list(lyfe.goals).filter(function (goal) { return goal.status !== "achieved"; }).length + " goals",
      activeItems(activeProjects, 6, "name", "description").concat(activeItems(list(lyfe.goals), 4, "title", "why")));

    var activeLibrary = input.activeObject && ["note", "doc", "saved"].indexOf(input.activeObject.type) >= 0
      ? [input.activeObject] : [];
    var recentLibrary = activeItems(list(lyfe.notes).slice(0, 4), 4, "title", "body")
      .concat(activeItems(list(lyfe.docs).slice(0, 4), 4, "title", "body"))
      .concat(activeItems(list(lyfe.saved).slice(0, 4), 4, "title", "body"));
    addSource(sources, sourcePolicy.library !== false, "library", "Library",
      list(lyfe.notes).length + " notes · " + list(lyfe.docs).length + " docs · " + list(lyfe.saved).length + " saved",
      activeLibrary.concat(recentLibrary).slice(0, 10));

    var connect = input.connect || {};
    var suite = input.connectSuite || {};
    var notifications = list(connect.notifications);
    var conversations = list(connect.conversations);
    var connectItems = activeItems(notifications.slice(0, 4), 4, "text", "kind")
      .concat(conversations.slice(0, 4).map(function (thread) {
        var messages = list(thread.messages);
        var last = messages[messages.length - 1] || {};
        return { id: text(thread.id, 100), title: text(thread.context || "Conversation", 180), detail: text(last.text, 260) };
      }));
    addSource(sources, sourcePolicy.connect !== false, "connect", "Connect",
      conversations.length + " conversations · " + list(suite.savedOpportunities).length + " saved opportunities · " + list(suite.pinnedMessages).length + " pins",
      connectItems, "private-connect");

    var gmail = list(input.gmail);
    addSource(sources, sourcePolicy.gmail !== false && gmail.length > 0, "gmail", "Gmail",
      gmail.length + " recent messages · metadata and snippets only",
      gmail.slice(0, 8).map(function (message) {
        return { id: text(message.id, 100), title: text(message.subject || "(no subject)", 180), detail: text((message.sender || "") + " · " + (message.snippet || ""), 260) };
      }), "private-gmail");

    addSource(sources, sourcePolicy.profile !== false, "profile", "Profile",
      [settings.name, settings.headline, list(settings.focus).join(", ")].filter(Boolean).join(" · ") || "Profile not completed",
      [], "private-profile");

    var knowledge = list(input.knowledge).slice(0, 8).map(function (item) {
      return {
        id: text(item.id, 160),
        title: text((item.sourceLabel ? item.sourceLabel + " · " : "") + (item.title || "Imported context"), 220),
        detail: text(item.detail, 760),
      };
    }).filter(function (item) { return item.detail; });
    addSource(sources, sourcePolicy.knowledge !== false && knowledge.length > 0, "knowledge", "Knowledge vault",
      knowledge.length + " relevant passage" + (knowledge.length === 1 ? "" : "s") + " · stored on this device",
      knowledge, "device-only");

    var aero = normalize(input.aero);
    var memories = aero.memories.filter(function (memory) {
      return memory.status === "active" || memory.status === "provisional";
    }).sort(function (a, b) { return b.updatedAt - a.updatedAt; }).slice(0, 8);
    var activeObject = input.activeObject && typeof input.activeObject === "object" ? {
      type: text(input.activeObject.type, 40),
      id: text(input.activeObject.id, 100),
      title: text(input.activeObject.title, 180),
      detail: text(input.activeObject.detail, 500),
    } : null;
    var pack = {
      id: id("ctx"),
      version: VERSION,
      createdAt: Date.now(),
      surface: surface,
      activeObject: activeObject,
      sources: sources,
      memories: memories,
      missing: [],
      provenanceCoverage: sources.length ? Math.min(1, 0.55 + sources.length * 0.08) : 0,
    };
    return pack;
  }

  function summarizeForPrompt(pack) {
    var lines = [
      "Context id: " + pack.id,
      "Active surface: " + pack.surface,
      "Provenance coverage: " + Math.round(pack.provenanceCoverage * 100) + "%",
    ];
    if (pack.activeObject) {
      lines.push("\n[Active object] " + pack.activeObject.type + ": " + pack.activeObject.title
        + (pack.activeObject.detail ? " - " + pack.activeObject.detail : ""));
    }
    pack.sources.forEach(function (source) {
      lines.push("\n[" + source.label + "] " + source.detail);
      source.items.slice(0, 8).forEach(function (item) {
        lines.push("- " + item.title + (item.detail ? ": " + item.detail : ""));
      });
    });
    if (pack.memories.length) {
      lines.push("\n[User-controlled memory]");
      pack.memories.forEach(function (memory) {
        lines.push("- " + memory.type + " · " + memory.scope + " · " + memory.status + ": " + memory.claim);
      });
    }
    return lines.join("\n");
  }

  function classifyIntent(signal) {
    var value = text(signal, 2000).toLowerCase();
    if (/\b(due|today|next|priority|matters)\b/.test(value)) return "triage";
    if (/\b(compare|research|paper|document|note|library)\b/.test(value)) return "research";
    if (/\b(follow up|reply|email|message|gmail|connect)\b/.test(value)) return "follow-up";
    if (/\b(remind|task|todo|goal|project|log|worked)\b/.test(value)) return "organize";
    if (/\b(remember|forget|prefer|usually|same as last time)\b/.test(value)) return "memory";
    return "general";
  }

  function routePlan(input) {
    input = input || {};
    var signal = text(input.signal, 2000);
    var value = signal.toLowerCase();
    var family = classifyIntent(signal);
    var engines = input.engines || {};
    var steps = signal.split(/\s+(?:and then|then|after that|also)\s+|[;\n]+/i)
      .map(function (step) { return text(step, 500); }).filter(Boolean).slice(0, 6);
    if (!steps.length) steps = [signal];
    var sensitive = /\b(private|personal|gmail|email|message|health|money|account|password|family|inbox|profile|library|lyfe)\b/.test(value);
    var personalContext = /\b(?:my|our|mine)\b.{0,40}\b(?:task|note|doc|project|goal|work|plan|schedule|history|memory|chat|file|people|contact)\b/.test(value);
    var workspaceAction = /^(?:please\s+)?(?:remind|add (?:a )?(?:task|note|goal|project)|create (?:a )?(?:task|note|doc|goal|project)|task|todo|note\s*:|doc\s*:|goal\s*:|learning\s*:|log\s+|done\s+|remember\s+that|forget\s+)/.test(value);
    var privacy = sensitive || personalContext || workspaceAction ? "private" : "standard";
    var preferred = engines.inklingLocal ? "inkling" : engines.ollama ? "ollama" : "built-in";
    var reason = engines.inklingLocal ? "private multimodal endpoint" : engines.ollama ? "local model available" : "local deterministic route";
    if (privacy !== "private" && input.cloudAllowed === true) {
      if (/\b(image|audio|voice|recording|screenshot|diagram|multimodal)\b/.test(value) && engines.inkling) {
        preferred = "inkling"; reason = "multimodal tool route";
      } else if (/\b(code|debug|repository|program|script)\b/.test(value) && engines.gpt) {
        preferred = "gpt"; reason = "coding route";
      } else if (/\b(research|compare|sources?|web|current|latest)\b/.test(value) && engines.gemini) {
        preferred = "gemini"; reason = "research route";
      } else if (engines.groq) {
        preferred = "groq";
        reason = family === "research" ? "cloud-safe research route" : /\b(code|debug|repository|program|script)\b/.test(value) ? "cloud-safe coding route" : "cloud-safe reasoning route";
      } else if (engines.gpt) {
        preferred = "gpt"; reason = "general reasoning route";
      }
    }
    return {
      family: family,
      privacy: privacy,
      engine: preferred,
      reason: reason,
      steps: steps.map(function (step, index) {
        return { id: "step-" + (index + 1), instruction: step, engine: preferred, status: "planned" };
      }),
    };
  }

  function wordCount(signal) {
    var words = text(signal, 2000).match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
    return words ? words.length : 1;
  }

  function beginEpisode(aero, signal, surface, contextId) {
    aero = normalize(aero);
    var family = classifyIntent(signal);
    var episode = {
      id: id("ep"),
      signal: text(signal, 2000),
      surface: text(surface, 50) || "aero",
      family: family,
      wordCount: wordCount(signal),
      coldBaseline: wordCount(signal),
      contextId: text(contextId, 100),
      outcome: "pending",
      createdAt: Date.now(),
    };
    aero.episodes.push(episode);
    if (aero.episodes.length > 500) aero.episodes = aero.episodes.slice(-500);
    return { aero: aero, episode: episode };
  }

  function epistemicDecision(input) {
    input = input || {};
    var signal = text(input.signal, 2000);
    var value = signal.toLowerCase();
    var pack = input.context || { sources: [], activeObject: null };
    var taskCapture = /^(?:please\s+)?(?:remind(?: me)?(?: to)?|add (?:a )?task|create (?:a )?task|new task|task|todo|remember to|i (?:need|have|gotta) to)\b/.test(value);
    var external = !taskCapture && (/\b(send|publish|post|pay|purchase|buy|submit)\b/.test(value)
      || /^(?:please\s+)?(?:email|message|follow up)\b/.test(value));
    var destructive = /\b(delete|erase|remove|cancel|withdraw)\b/.test(value);
    var ambiguousReference = /\b(him|her|them|that|this|it|thing)\b/.test(value);
    var sourceItemCount = list(pack.sources).reduce(function (sum, source) { return sum + list(source.items).length; }, 0);
    var hasObject = !!pack.activeObject;
    var hasSingularContext = hasObject || sourceItemCount === 1;
    var tiny = wordCount(signal) <= 2;
    if ((external || destructive) && ambiguousReference && !hasObject) {
      return { mode: "clarify", confidence: 0.35, question: "who or what exactly do you mean?" };
    }
    if (external) {
      return { mode: "preview", confidence: ambiguousReference ? 0.58 : 0.78, boundary: "draft-only", note: "Aero can prepare this, but cannot send it in v0." };
    }
    if (destructive) {
      return { mode: "clarify", confidence: 0.45, question: "which exact item should change? nothing will be removed without confirmation." };
    }
    if (tiny && !hasSingularContext) {
      return { mode: "clarify", confidence: 0.4, question: "what should i apply that to?" };
    }
    return { mode: "answer", confidence: hasObject ? 0.9 : 0.72 };
  }

  function finishEpisode(aero, episodeId, outcome, metadata) {
    aero = normalize(aero);
    var episode = aero.episodes.find(function (item) { return item.id === episodeId; });
    if (!episode) return aero;
    episode.outcome = ["helpful", "missed", "accepted", "rejected", "undone", "answered"].indexOf(outcome) >= 0 ? outcome : "answered";
    episode.firstPass = episode.outcome === "helpful" || episode.outcome === "accepted";
    episode.completedAt = Date.now();
    if (metadata && typeof metadata === "object") Object.assign(episode, metadata);
    return aero;
  }

  function observeOutcome(aero, episodeId, outcome, metadata) {
    aero = finishEpisode(aero, episodeId, outcome, metadata);
    var episode = aero.episodes.find(function (item) { return item.id === episodeId; });
    if (!episode || episode.wordCount > 8 || !episode.signal) return aero;
    var positive = outcome === "helpful" || outcome === "accepted";
    var negative = outcome === "missed" || outcome === "rejected" || outcome === "undone";
    if (!positive && !negative) return aero;
    var actionTypes = metadata && list(metadata.actionTypes).map(function (item) { return text(item, 60); }).filter(Boolean);
    if ((!actionTypes || !actionTypes.length) && episode.actionTypes) {
      actionTypes = list(episode.actionTypes).map(function (item) { return text(item, 60); }).filter(Boolean);
    }
    var target = actionTypes && actionTypes.length ? actionTypes.join(" + ") : episode.family;
    var signalKey = episode.signal.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, "").replace(/\s+/g, " ").trim();
    var patternKey = episode.surface + "|" + signalKey + "|" + target;
    var memory = aero.memories.find(function (item) { return item.patternKey === patternKey; });
    if (!memory && !positive) return aero;
    if (!memory) {
      aero = upsertMemory(aero, {
        type: "procedural", scope: episode.surface,
        claim: "On " + episode.surface + ", shorthand ‘" + text(episode.signal, 120) + "’ has meant " + target + ".",
        memoryKey: patternKey, patternKey: patternKey,
        sourceMode: "inferred", status: "candidate", confidence: 0.45,
        sourceRefs: [{ kind: "behavioral-outcome", id: episode.id, label: "Observed Aero outcome", at: Date.now() }],
      });
      memory = aero.memories.find(function (item) { return item.patternKey === patternKey; });
    }
    var day = new Date().toISOString().slice(0, 10);
    var polarity = positive ? "positive" : "negative";
    memory.episodeOutcomes = list(memory.episodeOutcomes);
    var prior = memory.episodeOutcomes.find(function (item) { return item.id === episode.id; });
    if (prior && prior.polarity === polarity) return aero;
    var before = {};
    rememberBefore(before, memory);
    if (prior) {
      if (prior.polarity === "positive") memory.successCount = Math.max(0, (memory.successCount || 0) - 1);
      else memory.failureCount = Math.max(0, (memory.failureCount || 0) - 1);
      prior.polarity = polarity;
      prior.outcome = outcome;
    } else {
      memory.episodeOutcomes.push({ id: episode.id, polarity: polarity, outcome: outcome });
    }
    memory.updatedAt = Date.now();
    memory.lastUsed = Date.now();
    if (positive) {
      memory.successCount = (memory.successCount || 0) + 1;
      memory.lastConfirmed = Date.now();
      if (memory.distinctDays.indexOf(day) < 0) memory.distinctDays.push(day);
      memory.evidence.push(outcome + " · " + day);
      memory.confidence = Math.min(0.88, 0.45 + memory.successCount * 0.11 + Math.min(0.1, memory.distinctDays.length * 0.03));
      if (memory.successCount >= 3 && memory.distinctDays.length >= 2 && (memory.failureCount || 0) === 0) {
        memory.status = "provisional";
        memory.wasPromoted = true;
      } else if (memory.status !== "provisional" && memory.status !== "active") {
        memory.status = "candidate";
      }
    } else {
      memory.failureCount = (memory.failureCount || 0) + 1;
      memory.contradictions.push(outcome + " · " + day);
      memory.confidence = Math.max(0.1, memory.confidence - 0.2);
      if (memory.failureCount >= 2 || memory.failureCount >= memory.successCount) memory.status = "disputed";
    }
    memory.evidence = memory.evidence.slice(-12);
    memory.distinctDays = memory.distinctDays.slice(-30);
    memory.contradictions = memory.contradictions.slice(-12);
    memory.episodeOutcomes = memory.episodeOutcomes.slice(-50);
    var affected = [memory.id];
    if (memory.status === "disputed") affected = mergeUnique(affected, invalidateDependents(aero, [memory.id], before, "A learned procedure became disputed."), 40);
    commitMemoryChanges(aero, {
      kind: positive ? "outcome-confirm" : "outcome-contradict",
      reason: positive ? "Verified behavior supported this memory" : "Observed outcome contradicted this memory",
      before: before, affectedIds: affected,
      sourceRefs: [{ kind: "behavioral-outcome", id: episode.id, label: outcome, at: Date.now() }],
    });
    return aero;
  }

  function metrics(aero) {
    aero = normalize(aero);
    var scored = aero.episodes.filter(function (episode) {
      return ["helpful", "missed", "accepted", "rejected", "undone"].indexOf(episode.outcome) >= 0;
    });
    var successful = scored.filter(function (episode) { return episode.firstPass === true; });
    var avgWords = successful.length ? successful.reduce(function (sum, episode) { return sum + episode.wordCount; }, 0) / successful.length : 0;
    var groups = {};
    successful.slice().sort(function (a, b) { return a.createdAt - b.createdAt; }).forEach(function (episode) {
      var actionTypes = list(episode.actionTypes).map(function (item) { return text(item, 60); }).filter(Boolean).sort();
      var key = actionTypes.length ? "action:" + actionTypes.join("+") : "family:" + episode.family;
      if (!groups[key]) groups[key] = [];
      groups[key].push(episode);
    });
    var comparable = [];
    Object.keys(groups).forEach(function (key) {
      var episodes = groups[key];
      if (episodes.length < 2) return;
      var baseline = episodes[0].wordCount;
      episodes.slice(1).forEach(function (episode) {
        comparable.push({ baseline: baseline, current: episode.wordCount, key: key });
      });
    });
    var avgCold = comparable.length ? comparable.reduce(function (sum, item) { return sum + item.baseline; }, 0) / comparable.length : 0;
    var avgComparable = comparable.length ? comparable.reduce(function (sum, item) { return sum + item.current; }, 0) / comparable.length : 0;
    var inferred = aero.memories.filter(function (memory) { return memory.sourceMode === "inferred"; });
    var promoted = inferred.filter(function (memory) { return memory.wasPromoted === true; });
    var falsePromotions = promoted.filter(function (memory) { return (memory.failureCount || 0) > 0; });
    var activeMemories = aero.memories.filter(function (memory) { return memory.status === "active" || memory.status === "provisional"; });
    var candidateMemories = aero.memories.filter(function (memory) { return memory.status === "candidate"; });
    return {
      episodes: aero.episodes.length,
      scored: scored.length,
      firstPassRate: scored.length ? successful.length / scored.length : null,
      averageWords: avgWords,
      coldBaseline: avgCold,
      compressionSamples: comparable.length,
      compression: avgCold > 0 ? 1 - avgComparable / avgCold : null,
      memories: aero.memories.length,
      activeMemories: activeMemories.length,
      candidateMemories: candidateMemories.length,
      disputedMemories: aero.memories.filter(function (memory) { return memory.status === "disputed"; }).length,
      supersededMemories: aero.memories.filter(function (memory) { return memory.status === "superseded"; }).length,
      invalidatedMemories: aero.memories.filter(function (memory) { return memory.status === "invalidated"; }).length,
      memoryRevision: aero.memoryRevision,
      memoryTransactions: aero.memoryJournal.length,
      memoryJournalValid: verifyMemoryJournal(aero).valid,
      promotionCount: promoted.length,
      falsePromotions: falsePromotions.length,
      falsePromotionRate: promoted.length ? falsePromotions.length / promoted.length : null,
      proofReady: comparable.length >= 5 && scored.length >= 10 && successful.length / scored.length >= 0.85
        && (!promoted.length || falsePromotions.length / promoted.length <= 0.05),
    };
  }

  function upsertMemory(aero, candidate) {
    aero = normalize(aero);
    candidate = candidate || {};
    var claim = text(candidate.claim, 800);
    if (!claim) return aero;
    var sourceMode = candidate.sourceMode === "inferred" ? "inferred" : "explicit";
    var sourceRefs = defaultSourceRefs(candidate);
    var memoryKey = memoryKeyFor(candidate, claim);
    var before = {};
    var existing = aero.memories.find(function (memory) {
      return memory.memoryKey === memoryKey && memory.claim.toLowerCase() === claim.toLowerCase()
        && ["superseded", "invalidated"].indexOf(memory.status) < 0;
    });
    if (existing) {
      rememberBefore(before, existing);
      var affectedExisting = [existing.id];
      existing.updatedAt = Date.now();
      existing.lastConfirmed = sourceMode === "explicit" ? Date.now() : existing.lastConfirmed;
      existing.sourceRefs = mergeUnique(existing.sourceRefs, sourceRefs, 16);
      existing.evidence = mergeUnique(existing.evidence, list(candidate.evidence).map(function (item) { return text(item, 120); }).filter(Boolean), 12);
      existing.confidence = Math.max(existing.confidence, Number(candidate.confidence == null ? (sourceMode === "explicit" ? 1 : existing.confidence) : candidate.confidence));
      if (sourceMode === "explicit") {
        existing.sourceMode = "explicit"; existing.status = "active"; existing.validUntil = 0;
        existing.dependsOn = Array.isArray(candidate.dependsOn)
          ? list(candidate.dependsOn).map(function (value) { return text(value, 100); }).filter(Boolean).slice(-24)
          : [];
        existing.invalidatedBy = [];
        var existingDependencyProblems = dependencyProblems(aero, existing.id, existing.dependsOn);
        if (existingDependencyProblems.length) {
          existing.status = "invalidated";
          existing.validUntil = Date.now();
          existing.invalidatedBy = existingDependencyProblems;
          existing.contradictions = mergeUnique(existing.contradictions, ["A declared dependency is missing, stale, or cyclic."], 12);
          affectedExisting = mergeUnique(affectedExisting, invalidateDependents(aero, [existing.id], before, "A source memory gained an invalid dependency."), 40);
        } else {
          var competing = aero.memories.filter(function (memory) {
            return memory.id !== existing.id && memory.memoryKey === memoryKey
              && memory.claim.toLowerCase() !== claim.toLowerCase()
              && ["active", "provisional", "candidate", "disputed"].indexOf(memory.status) >= 0;
          });
          competing.forEach(function (memory) {
            rememberBefore(before, memory);
            memory.status = "superseded"; memory.supersededBy = existing.id;
            memory.validUntil = Date.now(); memory.updatedAt = Date.now();
            existing.supersedes = mergeUnique(existing.supersedes, [memory.id], 12);
            affectedExisting.push(memory.id);
          });
          affectedExisting = mergeUnique(affectedExisting, invalidateDependents(aero, competing.map(function (memory) { return memory.id; }), before, "A direct user confirmation resolved a conflicting memory."), 40);
        }
      }
      commitMemoryChanges(aero, {
        kind: existing.status === "invalidated" ? "dependency-hold" : (affectedExisting.length > 1 ? "supersede" : "confirm"),
        reason: existing.status === "invalidated" ? "Memory held out because a declared dependency is unavailable" : (affectedExisting.length > 1 ? "Direct user confirmation resolved competing memory revisions" : "Confirmed an existing memory"),
        before: before, affectedIds: affectedExisting, sourceRefs: sourceRefs,
      });
      return aero;
    }

    var createdAt = Date.now();
    var memory = normalizeMemory({
      id: id("mem"), type: candidate.type, scope: candidate.scope,
      claim: claim, memoryKey: memoryKey, sourceMode: sourceMode,
      status: candidate.status || (sourceMode === "inferred" ? "candidate" : "active"),
      confidence: candidate.confidence == null ? (sourceMode === "inferred" ? 0.55 : 1) : candidate.confidence,
      evidence: list(candidate.evidence), sourceRefs: sourceRefs,
      patternKey: candidate.patternKey, dependsOn: list(candidate.dependsOn),
      supersedes: list(candidate.supersedes), successCount: 0, failureCount: 0,
      distinctDays: [], contradictions: [], episodeOutcomes: [], wasPromoted: false,
      createdAt: createdAt, updatedAt: createdAt, validFrom: createdAt,
    });
    var newDependencyProblems = dependencyProblems(aero, memory.id, memory.dependsOn);
    if (newDependencyProblems.length) {
      memory.status = "invalidated";
      memory.validUntil = createdAt;
      memory.invalidatedBy = newDependencyProblems;
      memory.contradictions = mergeUnique(memory.contradictions, ["A declared dependency is missing, stale, or cyclic."], 12);
    }
    var incumbents = aero.memories.filter(function (item) {
      return item.memoryKey === memoryKey && ["active", "provisional", "candidate"].indexOf(item.status) >= 0;
    });
    var explicitlySuperseded = list(candidate.supersedes).map(function (value) { return text(value, 100); }).filter(Boolean);
    explicitlySuperseded.forEach(function (memoryId) {
      var linked = aero.memories.find(function (item) { return item.id === memoryId; });
      if (linked && !incumbents.some(function (item) { return item.id === linked.id; })) incumbents.push(linked);
    });
    incumbents.sort(function (left, right) {
      if (left.sourceMode !== right.sourceMode) return left.sourceMode === "explicit" ? -1 : 1;
      return right.updatedAt - left.updatedAt;
    });
    var incumbent = incumbents[0] || null;
    var conflicts = incumbents.filter(function (item) { return item.claim.toLowerCase() !== claim.toLowerCase(); });
    if (sourceMode !== "explicit" && conflicts.length > 1) {
      conflicts = [conflicts[0]];
    }
    var affected = [memory.id];
    before[memory.id] = null;
    if (conflicts.length && memory.status !== "invalidated") {
      if (sourceMode === "explicit" || conflicts.every(function (item) { return explicitlySuperseded.indexOf(item.id) >= 0; })) {
        conflicts.forEach(function (item) {
          rememberBefore(before, item);
          affected.push(item.id);
          item.status = "superseded"; item.supersededBy = memory.id;
          item.validUntil = createdAt; item.updatedAt = createdAt;
          memory.supersedes = mergeUnique(memory.supersedes, [item.id], 12);
        });
        affected = mergeUnique(affected, invalidateDependents(aero, conflicts.map(function (item) { return item.id; }), before, "A source memory was superseded."), 40);
      } else if (incumbent) {
        rememberBefore(before, incumbent);
        affected.push(incumbent.id);
        memory.status = "disputed";
        memory.contradictions = mergeUnique(memory.contradictions, [incumbent.claim], 12);
        incumbent.contradictions = mergeUnique(incumbent.contradictions, [memory.claim], 12);
        if (incumbent.sourceMode === "inferred") {
          incumbent.status = "disputed";
          affected = mergeUnique(affected, invalidateDependents(aero, [incumbent.id], before, "An inferred source memory became disputed."), 40);
        }
        incumbent.updatedAt = createdAt;
      }
    }
    aero.memories.push(memory);
    commitMemoryChanges(aero, {
      kind: memory.status === "invalidated" ? "dependency-hold" : (conflicts.length ? (memory.status === "disputed" ? "conflict" : "supersede") : "create"),
      reason: memory.status === "invalidated" ? "Memory held out because a declared dependency is unavailable" : (conflicts.length ? (memory.status === "disputed" ? "Conflicting inferred memory held for review" : "Newer explicit memory superseded the prior revision") : "Created a source-supported memory"),
      before: before, affectedIds: affected, sourceRefs: sourceRefs,
    });
    return aero;
  }

  function forgetMemory(aero, memoryIdOrClaim) {
    aero = normalize(aero);
    var query = text(memoryIdOrClaim, 800).toLowerCase();
    if (!query) return aero;
    var targets = aero.memories.filter(function (memory) {
      return memory.id.toLowerCase() === query || memory.claim.toLowerCase().indexOf(query) >= 0;
    });
    if (!targets.length) return aero;
    var targetIds = targets.map(function (memory) { return memory.id; });
    var before = {};
    targets.forEach(function (memory) { rememberBefore(before, memory); });
    var invalidated = invalidateDependents(aero, targetIds, before, "A dependency was forgotten by the user.");
    scrubForgottenFromJournal(aero, targetIds);
    aero.memories = aero.memories.filter(function (memory) { return targetIds.indexOf(memory.id) < 0; });
    commitMemoryChanges(aero, {
      kind: "forget", reason: "User-requested privacy deletion",
      before: before, affectedIds: targetIds.concat(invalidated),
      redactBeforeIds: targetIds, sourceRefs: [{ kind: "user-explicit", id: "forget-control", label: "Forgotten by the user", at: Date.now() }],
      reversible: false,
    });
    return aero;
  }

  function validateAction(action) {
    if (!action || typeof action !== "object" || ACTION_TYPES.indexOf(action.type) < 0) return null;
    var clean = { type: action.type };
    ["title", "name", "body", "text", "why", "description", "provider", "kind", "area", "priority", "date", "due", "horizon", "claim", "scope", "memoryType", "memoryKey", "query"].forEach(function (key) {
      if (action[key] != null) clean[key] = text(action[key], key === "body" || key === "text" || key === "claim" ? 2000 : 240);
    });
    ["dependsOn", "supersedes"].forEach(function (key) {
      if (Array.isArray(action[key])) clean[key] = action[key].map(function (value) { return text(value, 100); }).filter(Boolean).slice(0, 24);
    });
    if (action.hours != null && isFinite(Number(action.hours))) clean.hours = Math.max(0, Math.min(24, Number(action.hours)));
    if (action.type === "memory_upsert" && !clean.claim) return null;
    if (action.type === "memory_forget" && !(clean.query || clean.claim)) return null;
    if (action.type !== "memory_forget" && action.type !== "complete_task" && action.type !== "log_work" && action.type !== "memory_upsert" && !(clean.title || clean.name || clean.body)) return null;
    return clean;
  }

  function actionSummary(actions) {
    actions = list(actions).map(validateAction).filter(Boolean);
    if (!actions.length) return "No change";
    if (actions.length > 1) return actions.length + " proposed changes";
    var action = actions[0];
    var labels = {
      add_task: "Create a task", complete_task: "Complete a task", add_note: "Save a note",
      add_doc: "Create a document", log_work: "Log work", add_goal: "Create a goal",
      add_education: "Add learning", add_project: "Create a project",
      memory_upsert: "Teach Aero", memory_forget: "Forget a memory",
    };
    return labels[action.type] || "Proposed change";
  }

  function redact(value) {
    return text(value, 8000)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
      .replace(/(?:\+?\d[\s().-]?){8,}\d/g, "[phone]");
  }

  function trainingExamples(aero, chat) {
    aero = normalize(aero);
    chat = list(chat);
    var allowedEpisodes = new Set(aero.episodes.filter(function (episode) {
      return episode.firstPass === true && episode.outcome === "helpful";
    }).map(function (episode) { return episode.id; }));
    var examples = [];
    chat.forEach(function (message, index) {
      if (message.role !== "user" || !message.episodeId || !allowedEpisodes.has(message.episodeId)) return;
      var reply = chat.slice(index + 1).find(function (item) { return item.role !== "user" && item.episodeId === message.episodeId; });
      if (!reply) return;
      examples.push({
        messages: [
          { role: "user", content: redact(message.text) },
          { role: "assistant", content: redact(reply.text) },
        ],
        metadata: { family: classifyIntent(message.text), source: "consented-aero-feedback", schema: VERSION },
      });
    });
    return examples.slice(-500);
  }

  var responseSchema = {
    type: "object",
    properties: {
      bubbles: { type: "array", items: { type: "string" }, maxItems: 4 },
      actions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ACTION_TYPES }, title: { type: "string" }, name: { type: "string" },
            body: { type: "string" }, text: { type: "string" }, claim: { type: "string" }, query: { type: "string" },
            scope: { type: "string" }, memoryType: { type: "string", enum: MEMORY_TYPES }, memoryKey: { type: "string" },
            dependsOn: { type: "array", items: { type: "string" }, maxItems: 24 },
            supersedes: { type: "array", items: { type: "string" }, maxItems: 12 }, due: { type: ["string", "null"] },
            date: { type: ["string", "null"] }, hours: { type: ["number", "null"] }, area: { type: "string" }, priority: { type: "string" }
          },
          required: ["type"]
        }
      },
      assumption: { type: "string" }
    },
    required: ["bubbles", "actions"]
  };

  window.AeroCore = {
    version: VERSION,
    freshState: freshState,
    normalize: normalize,
    contextPack: contextPack,
    summarizeForPrompt: summarizeForPrompt,
    classifyIntent: classifyIntent,
    routePlan: routePlan,
    epistemicDecision: epistemicDecision,
    beginEpisode: beginEpisode,
    finishEpisode: finishEpisode,
    observeOutcome: observeOutcome,
    metrics: metrics,
    upsertMemory: upsertMemory,
    forgetMemory: forgetMemory,
    recoverMemoryTransaction: recoverMemoryTransaction,
    verifyMemoryJournal: verifyMemoryJournal,
    memoryKeyFor: memoryKeyFor,
    validateAction: validateAction,
    actionSummary: actionSummary,
    trainingExamples: trainingExamples,
    responseSchema: responseSchema,
  };
})();
