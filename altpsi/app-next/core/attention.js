(function (root) {
  "use strict";

  var VERSION = "aero-attention-v0.1";
  var MAX_NOTIFICATIONS = 80;
  var MAX_TELEMETRY = 200;
  var SECOND_INTERRUPT_GAP_MS = 60 * 60 * 1000;
  var URGENCY = { ambient: 0, important: 1, urgent: 2, critical: 3 };
  var INTERRUPT_SOURCES = ["task", "run", "calendar", "system"];

  function list(value) { return Array.isArray(value) ? value : []; }

  function clean(value, maximum) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, maximum || 240);
  }

  function bounded(value, minimum, maximum, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = Number(fallback || 0);
    return Math.max(minimum, Math.min(maximum, number));
  }

  function dayKey(at) {
    var date = new Date(Number(at || Date.now()));
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function digest(value) {
    if (root.AeroHarness && typeof root.AeroHarness.digestValue === "function") {
      return root.AeroHarness.digestValue(value).replace(/^sha256-/, "");
    }
    var input = JSON.stringify(value);
    var hash = 2166136261;
    for (var index = 0; index < input.length; index++) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function freshState(at) {
    return {
      version: 1,
      day: dayKey(at),
      proactiveCount: 0,
      lastProactiveAt: 0,
      lastProactiveCategory: "",
      proactiveFingerprints: [],
      dismissedFingerprints: [],
      notifications: [],
      feedback: {},
      telemetry: [],
    };
  }

  function normalizeNotification(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    var fingerprint = clean(value.fingerprint, 80).toLowerCase();
    var urgency = Object.prototype.hasOwnProperty.call(URGENCY, value.urgency) ? value.urgency : "ambient";
    if (!fingerprint || !clean(value.title, 180)) return null;
    return {
      id: clean(value.id, 120) || "attention-" + fingerprint.slice(0, 24),
      fingerprint: fingerprint,
      category: clean(value.category, 60).toLowerCase() || "update",
      urgency: urgency,
      title: clean(value.title, 180),
      detail: clean(value.detail, 360),
      sourceType: clean(value.sourceType, 40).toLowerCase() || "unknown",
      sourceRef: clean(value.sourceRef, 300),
      createdAt: Math.max(1, Number(value.createdAt || Date.now())),
      expiresAt: Math.max(0, Number(value.expiresAt || 0)),
      read: value.read === true,
      interrupted: value.interrupted === true,
      outcomes: list(value.outcomes).map(function (item) { return clean(item, 20).toLowerCase(); })
        .filter(function (item, index, values) {
          return ["opened", "helpful", "dismissed"].indexOf(item) >= 0 && values.indexOf(item) === index;
        }).slice(0, 3),
    };
  }

  function normalizeState(value, at) {
    var currentDay = dayKey(at);
    var raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    var state = freshState(at);
    state.day = currentDay;
    state.proactiveCount = clean(raw.day, 10) === currentDay
      ? Math.round(bounded(raw.proactiveCount, 0, 2, 0)) : 0;
    state.lastProactiveAt = clean(raw.day, 10) === currentDay
      ? Math.max(0, Number(raw.lastProactiveAt || 0)) : 0;
    state.lastProactiveCategory = clean(raw.day, 10) === currentDay
      ? clean(raw.lastProactiveCategory, 60).toLowerCase() : "";
    state.proactiveFingerprints = list(raw.proactiveFingerprints).map(function (item) {
      return clean(item, 80).toLowerCase();
    }).filter(Boolean).slice(-80);
    state.dismissedFingerprints = list(raw.dismissedFingerprints).map(function (item) {
      return clean(item, 80).toLowerCase();
    }).filter(Boolean).slice(-80);

    var seen = new Set();
    state.notifications = list(raw.notifications).map(normalizeNotification).filter(function (item) {
      if (!item || seen.has(item.fingerprint)) return false;
      seen.add(item.fingerprint);
      return !item.expiresAt || item.expiresAt > Number(at || Date.now());
    }).sort(function (left, right) { return right.createdAt - left.createdAt; }).slice(0, MAX_NOTIFICATIONS);

    state.feedback = {};
    Object.keys(raw.feedback && typeof raw.feedback === "object" ? raw.feedback : {}).slice(0, 60).forEach(function (category) {
      var item = raw.feedback[category] || {};
      state.feedback[clean(category, 60).toLowerCase()] = {
        opened: Math.round(bounded(item.opened, 0, 1000, 0)),
        helpful: Math.round(bounded(item.helpful, 0, 1000, 0)),
        dismissed: Math.round(bounded(item.dismissed, 0, 1000, 0)),
        lastAt: Math.max(0, Number(item.lastAt || 0)),
      };
    });
    state.telemetry = list(raw.telemetry).map(function (item) {
      if (!item || typeof item !== "object") return null;
      return {
        at: Math.max(1, Number(item.at || Date.now())),
        fingerprint: clean(item.fingerprint, 80).toLowerCase(),
        category: clean(item.category, 60).toLowerCase(),
        urgency: Object.prototype.hasOwnProperty.call(URGENCY, item.urgency) ? item.urgency : "ambient",
        sourceType: clean(item.sourceType, 40).toLowerCase() || "unknown",
        decision: ["interrupt", "feed", "feedback"].indexOf(item.decision) >= 0 ? item.decision : "feed",
        reason: clean(item.reason, 80).toLowerCase(),
      };
    }).filter(Boolean).slice(-MAX_TELEMETRY);
    return state;
  }

  function normalizeCandidate(value, at) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    var title = clean(value.title, 180);
    var category = clean(value.category, 60).toLowerCase();
    var sourceType = clean(value.sourceType, 40).toLowerCase();
    var sourceRef = clean(value.sourceRef, 300);
    var urgency = Object.prototype.hasOwnProperty.call(URGENCY, value.urgency) ? value.urgency : "ambient";
    if (!title || !category || !sourceType || !sourceRef) return null;
    var occurrence = clean(value.occurrenceKey, 100) || dayKey(at);
    return {
      fingerprint: digest({ category: category, sourceType: sourceType, sourceRef: sourceRef, occurrence: occurrence }),
      category: category,
      urgency: urgency,
      title: title,
      detail: clean(value.detail, 360),
      sourceType: sourceType,
      sourceRef: sourceRef,
      dueAt: Math.max(0, Number(value.dueAt || 0)),
      expiresAt: Math.max(0, Number(value.expiresAt || 0)),
    };
  }

  function inQuietHours(at, quietHours) {
    var date = new Date(Number(at || Date.now()));
    var start = Math.round(bounded(quietHours && quietHours.start, 0, 23, 22));
    var end = Math.round(bounded(quietHours && quietHours.end, 0, 23, 8));
    var hour = date.getHours();
    if (start === end) return false;
    return start < end ? hour >= start && hour < end : hour >= start || hour < end;
  }

  function preferenceSuppresses(state, category) {
    var value = state.feedback[category];
    return !!(value && value.dismissed >= 2 && value.opened + value.helpful === 0);
  }

  function interruptionDecision(state, candidate, policy, at) {
    var mode = ["off", "brief", "critical-only"].indexOf(policy.mode) >= 0 ? policy.mode : "brief";
    if (mode === "off") return "mode-off";
    if (policy.focused === true) return "focused";
    if (inQuietHours(at, policy.quietHours)) return "quiet-hours";
    if (INTERRUPT_SOURCES.indexOf(candidate.sourceType) < 0) return "untrusted-source";
    if (candidate.urgency !== "urgent" && candidate.urgency !== "critical") return "below-threshold";
    if (mode === "critical-only" && candidate.urgency !== "critical") return "below-threshold";
    if (preferenceSuppresses(state, candidate.category) && candidate.urgency !== "critical") return "learned-silence";
    if (state.proactiveFingerprints.indexOf(candidate.fingerprint) >= 0) return "duplicate";
    if (state.proactiveCount >= 2) return "daily-budget";
    if (state.proactiveCount === 1) {
      if (candidate.urgency !== "critical") return "second-must-be-critical";
      if (candidate.category === state.lastProactiveCategory) return "second-must-be-distinct";
      if (Number(at) - state.lastProactiveAt < SECOND_INTERRUPT_GAP_MS) return "second-too-soon";
    }
    return "eligible";
  }

  function telemetry(candidate, decision, reason, at) {
    return {
      at: Number(at || Date.now()),
      fingerprint: candidate.fingerprint,
      category: candidate.category,
      urgency: candidate.urgency,
      sourceType: candidate.sourceType,
      decision: decision,
      reason: reason,
    };
  }

  function refresh(rawState, candidates, policy, at) {
    at = Number(at || Date.now());
    policy = policy && typeof policy === "object" ? policy : {};
    var priorDay = clean(rawState && rawState.day, 10);
    var state = normalizeState(rawState, at);
    var known = new Set(state.notifications.map(function (item) { return item.fingerprint; }).concat(state.dismissedFingerprints));
    var normalized = list(candidates).map(function (item) { return normalizeCandidate(item, at); }).filter(Boolean)
      .filter(function (item) { return !item.expiresAt || item.expiresAt > at; })
      .sort(function (left, right) {
        return URGENCY[right.urgency] - URGENCY[left.urgency]
          || (left.dueAt || Number.MAX_SAFE_INTEGER) - (right.dueAt || Number.MAX_SAFE_INTEGER)
          || left.fingerprint.localeCompare(right.fingerprint);
      });
    var added = [];
    var interrupt = null;
    var changed = priorDay !== state.day;

    normalized.forEach(function (candidate) {
      if (known.has(candidate.fingerprint)) return;
      known.add(candidate.fingerprint);
      var reason = interruptionDecision(state, candidate, policy, at);
      var shouldInterrupt = !interrupt && reason === "eligible";
      var note = normalizeNotification({
        id: "attention-" + candidate.fingerprint.slice(0, 24),
        fingerprint: candidate.fingerprint,
        category: candidate.category,
        urgency: candidate.urgency,
        title: candidate.title,
        detail: candidate.detail,
        sourceType: candidate.sourceType,
        sourceRef: candidate.sourceRef,
        createdAt: at,
        expiresAt: candidate.expiresAt,
        read: false,
        interrupted: shouldInterrupt,
      });
      state.notifications.unshift(note);
      added.push(note);
      state.telemetry.push(telemetry(candidate, shouldInterrupt ? "interrupt" : "feed", shouldInterrupt ? "eligible" : reason, at));
      if (shouldInterrupt) {
        interrupt = note;
        state.proactiveCount += 1;
        state.lastProactiveAt = at;
        state.lastProactiveCategory = candidate.category;
        state.proactiveFingerprints.push(candidate.fingerprint);
      }
      changed = true;
    });

    state.notifications = state.notifications.slice(0, MAX_NOTIFICATIONS);
    state.telemetry = state.telemetry.slice(-MAX_TELEMETRY);
    state.proactiveFingerprints = state.proactiveFingerprints.slice(-80);
    state.dismissedFingerprints = state.dismissedFingerprints.slice(-80);
    return { state: state, interrupt: interrupt, added: added, changed: changed };
  }

  function feedback(rawState, notificationId, outcome, at) {
    at = Number(at || Date.now());
    var state = normalizeState(rawState, at);
    var item = state.notifications.find(function (notification) { return notification.id === notificationId; });
    if (!item || ["opened", "helpful", "dismissed"].indexOf(outcome) < 0) return state;
    if (item.outcomes.indexOf(outcome) >= 0) return state;
    if (!state.feedback[item.category]) state.feedback[item.category] = { opened: 0, helpful: 0, dismissed: 0, lastAt: 0 };
    state.feedback[item.category][outcome] += 1;
    state.feedback[item.category].lastAt = at;
    item.read = true;
    item.outcomes.push(outcome);
    if (outcome === "dismissed" && state.dismissedFingerprints.indexOf(item.fingerprint) < 0) {
      state.dismissedFingerprints.push(item.fingerprint);
      state.dismissedFingerprints = state.dismissedFingerprints.slice(-80);
    }
    state.telemetry.push(telemetry(item, "feedback", outcome, at));
    state.telemetry = state.telemetry.slice(-MAX_TELEMETRY);
    return state;
  }

  function markAllRead(rawState, at) {
    var state = normalizeState(rawState, at);
    state.notifications.forEach(function (item) { item.read = true; });
    return state;
  }

  function summary(rawState, at) {
    var state = normalizeState(rawState, at);
    return {
      unread: state.notifications.filter(function (item) { return !item.read; }).length,
      total: state.notifications.length,
      interruptedToday: state.proactiveCount,
    };
  }

  function dateAtNoon(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(value, 10))) return 0;
    var parts = value.split("-").map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function groupTaskCandidate(category, tasks, urgency, day, at) {
    if (!tasks.length) return null;
    var ordered = tasks.slice().sort(function (left, right) {
      return (right.priority === "High") - (left.priority === "High")
        || clean(left.title, 180).localeCompare(clean(right.title, 180));
    });
    var first = ordered[0];
    var extra = ordered.length > 1 ? " + " + (ordered.length - 1) + " more" : "";
    var labels = {
      overdue: ordered.length === 1 ? "One loop is overdue" : ordered.length + " loops are overdue",
      today: ordered.length === 1 ? "One loop is due today" : ordered.length + " loops are due today",
      tomorrow: ordered.length === 1 ? "One high-priority loop is due tomorrow" : ordered.length + " high-priority loops are due tomorrow",
    };
    return {
      category: category,
      urgency: urgency,
      title: labels[category],
      detail: clean(first.title, 180) + extra,
      sourceType: "task",
      sourceRef: ordered.map(function (task) { return clean(task.id, 100); }).sort().join(","),
      occurrenceKey: day,
      dueAt: dateAtNoon(first.due),
      expiresAt: at + 36 * 60 * 60 * 1000,
    };
  }

  function deriveCandidates(data, at) {
    at = Number(at || Date.now());
    data = data && typeof data === "object" ? data : {};
    var today = dateAtNoon(dayKey(at));
    var oneDay = 24 * 60 * 60 * 1000;
    var open = list(data.tasks).filter(function (task) {
      return task && task.status !== "done" && task.status !== "completed" && dateAtNoon(task.due);
    });
    var overdue = open.filter(function (task) { return dateAtNoon(task.due) < today; });
    var dueToday = open.filter(function (task) { return dateAtNoon(task.due) === today; });
    var dueTomorrow = open.filter(function (task) { return dateAtNoon(task.due) === today + oneDay && task.priority === "High"; });
    var candidates = [];
    var grouped = [
      groupTaskCandidate("overdue", overdue, overdue.some(function (task) { return task.priority === "High"; }) ? "critical" : "urgent", dayKey(at), at),
      groupTaskCandidate("today", dueToday, dueToday.some(function (task) { return task.priority === "High"; }) ? "urgent" : "important", dayKey(at), at),
      groupTaskCandidate("tomorrow", dueTomorrow, "important", dayKey(at), at),
    ];
    grouped.filter(Boolean).forEach(function (candidate) { candidates.push(candidate); });

    list(data.aeroRuns).filter(function (run) {
      var updatedAt = Number(run && (run.updatedAt || run.createdAt) || 0);
      return run && run.status === "failed" && updatedAt && at - updatedAt <= oneDay;
    }).slice(-3).forEach(function (run) {
      var unsafeRollback = run.transaction && run.transaction.state === "rollback-failed";
      candidates.push({
        category: "execution",
        urgency: unsafeRollback ? "critical" : "important",
        title: unsafeRollback ? "A change needs recovery" : "A change stopped safely",
        detail: clean(run.intent, 240) || "Open the activity receipt for details.",
        sourceType: "run",
        sourceRef: clean(run.id, 120),
        occurrenceKey: clean(run.id, 120),
        dueAt: Number(run.updatedAt || run.createdAt),
        expiresAt: at + oneDay,
      });
    });
    return candidates;
  }

  root.AeroAttention = {
    VERSION: VERSION,
    freshState: freshState,
    normalize: normalizeState,
    normalizeCandidate: normalizeCandidate,
    deriveCandidates: deriveCandidates,
    interruptionDecision: interruptionDecision,
    refresh: refresh,
    feedback: feedback,
    markAllRead: markAllRead,
    summary: summary,
  };
})(typeof window !== "undefined" ? window : globalThis);
