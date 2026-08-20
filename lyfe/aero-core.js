/* ============================================================
   Aero Core v0.1
   Clean-room, local-first product intelligence for Lyfe.

   This module contains no EOS, IISc, or unpublished research code. It is a
   small auditable layer for bounded context, typed user-controlled memory,
   action validation, and communication-compression evaluation.
   ============================================================ */
(function () {
  "use strict";

  var VERSION = "aero-core-v0.1";
  var MEMORY_TYPES = ["episodic", "semantic", "project", "procedural"];
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

  function freshState() {
    return {
      version: 1,
      memories: [],
      episodes: [],
      lastContext: null,
      createdAt: Date.now(),
    };
  }

  function normalize(raw) {
    var base = freshState();
    if (!raw || typeof raw !== "object") return base;
    base.memories = list(raw.memories).filter(function (memory) {
      return memory && typeof memory === "object" && text(memory.claim, 800);
    }).slice(-300).map(function (memory) {
      return {
        id: text(memory.id, 100) || id("mem"),
        type: MEMORY_TYPES.indexOf(memory.type) >= 0 ? memory.type : "semantic",
        scope: text(memory.scope, 100) || "global",
        claim: text(memory.claim, 800),
        sourceMode: memory.sourceMode === "inferred" ? "inferred" : "explicit",
        status: ["candidate", "provisional", "active", "disputed"].indexOf(memory.status) >= 0 ? memory.status : "active",
        confidence: Math.max(0, Math.min(1, Number(memory.confidence == null ? 1 : memory.confidence))),
        evidence: list(memory.evidence).map(function (item) { return text(item, 120); }).filter(Boolean).slice(-12),
        patternKey: text(memory.patternKey, 240),
        successCount: Math.max(0, Number(memory.successCount) || 0),
        failureCount: Math.max(0, Number(memory.failureCount) || 0),
        distinctDays: list(memory.distinctDays).map(function (day) { return text(day, 10); }).filter(Boolean).slice(-30),
        lastUsed: Number(memory.lastUsed) || 0,
        lastConfirmed: Number(memory.lastConfirmed) || 0,
        contradictions: list(memory.contradictions).map(function (item) { return text(item, 160); }).filter(Boolean).slice(-12),
        episodeOutcomes: list(memory.episodeOutcomes).filter(function (item) {
          return item && typeof item === "object" && text(item.id, 100);
        }).slice(-50).map(function (item) {
          return {
            id: text(item.id, 100),
            polarity: item.polarity === "negative" ? "negative" : "positive",
            outcome: text(item.outcome, 30),
          };
        }),
        wasPromoted: memory.wasPromoted === true,
        createdAt: Number(memory.createdAt) || Date.now(),
        updatedAt: Number(memory.updatedAt) || Number(memory.createdAt) || Date.now(),
      };
    });
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
      memory = {
        id: id("mem"), type: "procedural", scope: episode.surface,
        claim: "On " + episode.surface + ", shorthand ‘" + text(episode.signal, 120) + "’ has meant " + target + ".",
        sourceMode: "inferred", status: "candidate", confidence: 0.45,
        evidence: [], patternKey: patternKey, successCount: 0, failureCount: 0,
        distinctDays: [], contradictions: [], episodeOutcomes: [], wasPromoted: false,
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      aero.memories.push(memory);
    }
    var day = new Date().toISOString().slice(0, 10);
    var polarity = positive ? "positive" : "negative";
    memory.episodeOutcomes = list(memory.episodeOutcomes);
    var prior = memory.episodeOutcomes.find(function (item) { return item.id === episode.id; });
    if (prior && prior.polarity === polarity) return aero;
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
    if (aero.memories.length > 300) aero.memories = aero.memories.slice(-300);
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
    var normalizedClaim = claim.toLowerCase();
    var existing = aero.memories.find(function (memory) { return memory.claim.toLowerCase() === normalizedClaim; });
    if (existing) {
      existing.updatedAt = Date.now();
      existing.status = candidate.status || existing.status;
      existing.confidence = Math.max(existing.confidence, Number(candidate.confidence) || 1);
      return aero;
    }
    aero.memories.push({
      id: id("mem"),
      type: MEMORY_TYPES.indexOf(candidate.type) >= 0 ? candidate.type : "semantic",
      scope: text(candidate.scope, 100) || "global",
      claim: claim,
      sourceMode: candidate.sourceMode === "inferred" ? "inferred" : "explicit",
      status: candidate.status || (candidate.sourceMode === "inferred" ? "candidate" : "active"),
      confidence: Math.max(0, Math.min(1, Number(candidate.confidence == null ? (candidate.sourceMode === "inferred" ? 0.55 : 1) : candidate.confidence))),
      evidence: list(candidate.evidence).map(function (item) { return text(item, 120); }).filter(Boolean).slice(-12),
      successCount: 0,
      failureCount: 0,
      distinctDays: [],
      contradictions: [],
      episodeOutcomes: [],
      wasPromoted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    if (aero.memories.length > 300) aero.memories = aero.memories.slice(-300);
    return aero;
  }

  function forgetMemory(aero, memoryIdOrClaim) {
    aero = normalize(aero);
    var query = text(memoryIdOrClaim, 800).toLowerCase();
    aero.memories = aero.memories.filter(function (memory) {
      return memory.id.toLowerCase() !== query && memory.claim.toLowerCase().indexOf(query) < 0;
    });
    return aero;
  }

  function validateAction(action) {
    if (!action || typeof action !== "object" || ACTION_TYPES.indexOf(action.type) < 0) return null;
    var clean = { type: action.type };
    ["title", "name", "body", "text", "why", "description", "provider", "kind", "area", "priority", "date", "due", "horizon", "claim", "scope", "memoryType", "query"].forEach(function (key) {
      if (action[key] != null) clean[key] = text(action[key], key === "body" || key === "text" || key === "claim" ? 2000 : 240);
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
            scope: { type: "string" }, memoryType: { type: "string", enum: MEMORY_TYPES }, due: { type: ["string", "null"] },
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
    epistemicDecision: epistemicDecision,
    beginEpisode: beginEpisode,
    finishEpisode: finishEpisode,
    observeOutcome: observeOutcome,
    metrics: metrics,
    upsertMemory: upsertMemory,
    forgetMemory: forgetMemory,
    validateAction: validateAction,
    actionSummary: actionSummary,
    trainingExamples: trainingExamples,
    responseSchema: responseSchema,
  };
})();
