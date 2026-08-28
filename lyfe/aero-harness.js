/* ============================================================
   Aero Harness v0.3
   Clean-room, model-neutral execution control for Lyfe.

   Plans are durable, bounded and inspectable. A model can propose work, but
   only this module can move a run through approval and local execution.
   ============================================================ */
(function () {
  "use strict";

  var VERSION = "aero-harness-v0.3";
  var MAX_STEPS = 12;
  var MAX_EVENTS = 160;
  var ACTION_LABELS = {
    add_task: "Create task", complete_task: "Complete task", add_note: "Save note",
    add_doc: "Create document", log_work: "Log work", add_goal: "Create goal",
    add_education: "Add learning", add_project: "Create project",
    memory_upsert: "Remember", memory_forget: "Forget memory",
  };
  var ALLOWED_ACTIONS = Object.keys(ACTION_LABELS);

  function list(value) { return Array.isArray(value) ? value : []; }
  function text(value, max) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 500); }
  function now() { return Date.now(); }
  function id(prefix) {
    try { return prefix + "_" + crypto.randomUUID(); }
    catch (error) { return prefix + "_" + now().toString(36) + Math.random().toString(36).slice(2, 9); }
  }
  function event(type, detail) { return { id: id("evt"), type: type, detail: text(detail, 280), at: now() }; }
  function actionSubject(action) {
    return text(action && (action.title || action.name || action.claim || action.query || action.text || action.body), 180) || "item";
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce(function (out, key) {
      if (value[key] !== undefined) out[key] = canonical(value[key]);
      return out;
    }, {});
  }
  function digestActions(actions) {
    var input = JSON.stringify(list(actions).map(canonical));
    var hash = 2166136261;
    for (var index = 0; index < input.length; index++) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return "fnv1a-" + (hash >>> 0).toString(16).padStart(8, "0");
  }
  function actionAllowed(action) { return ALLOWED_ACTIONS.indexOf(text(action && action.type, 60)) >= 0; }
  function capabilityFor(action) {
    var type = text(action && action.type, 60);
    if (!actionAllowed(action)) return "";
    if (type.indexOf("memory_") === 0) return "memory.write";
    if (type === "log_work") return "tracking.worklog.write";
    if (type === "add_note" || type === "add_doc") return "library.write";
    return "tracking.write";
  }
  function postcondition(action) {
    var type = action && action.type;
    if (type === "complete_task") return "The intended task is marked complete.";
    if (type === "memory_forget") return "The selected memory is no longer active.";
    if (type === "log_work") return "One matching work-log entry exists.";
    return "One matching Lyfe record exists.";
  }

  function createRun(input) {
    input = input || {};
    var runId = id("run");
    var actions = list(input.actions).slice(0, MAX_STEPS);
    var steps = actions.map(function (action, index) {
      return {
        id: id("step"),
        index: index,
        title: (ACTION_LABELS[action.type] || "Update Lyfe") + ": " + actionSubject(action),
        action: action,
        capability: capabilityFor(action),
        authority: actionAllowed(action) ? "approval-required" : "denied",
        risk: actionAllowed(action) ? "low-reversible" : "unsupported",
        route: "local-action-engine",
        status: "proposed",
        attempts: 0,
        idempotencyKey: runId + ":" + index,
        acceptance: postcondition(action),
        postcondition: postcondition(action),
        startedAt: 0,
        finishedAt: 0,
        error: "",
      };
    });
    return {
      id: runId,
      version: VERSION,
      threadId: text(input.threadId, 120),
      episodeId: text(input.episodeId, 120),
      intent: text(input.intent, 1_000),
      status: steps.length ? "awaiting-approval" : "completed",
      planDigest: digestActions(actions),
      approval: null,
      budget: { maxSteps: MAX_STEPS, maxRetriesPerStep: 1, maxCloudCalls: 0, maxDurationMs: 10_000 },
      steps: steps,
      checkpoint: { nextStep: 0, completedKeys: [] },
      taskState: {
        goal: text(input.intent, 1_000),
        verifiedFacts: [],
        unmetStepIds: steps.map(function (step) { return step.id; }),
        auditRound: 0,
      },
      events: [event("run.created", steps.length + " proposed step" + (steps.length === 1 ? "" : "s"))],
      createdAt: now(),
      updatedAt: now(),
    };
  }

  function normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    var run = Object.assign({}, raw);
    run.id = text(run.id, 140) || id("run");
    run.version = VERSION;
    run.status = ["awaiting-approval", "approved", "running", "completed", "failed", "cancelled"].indexOf(run.status) >= 0 ? run.status : "awaiting-approval";
    run.steps = list(run.steps).slice(0, MAX_STEPS).map(function (step, index) {
      return Object.assign({}, step, {
        id: text(step && step.id, 140) || id("step"), index: index,
        title: text(step && step.title, 260) || "Update Lyfe",
        capability: capabilityFor(step && step.action),
        authority: actionAllowed(step && step.action) ? "approval-required" : "denied",
        risk: actionAllowed(step && step.action) ? "low-reversible" : "unsupported",
        route: "local-action-engine",
        status: ["proposed", "ready", "running", "succeeded", "failed", "cancelled"].indexOf(step && step.status) >= 0 ? step.status : "proposed",
        attempts: Math.max(0, Math.min(2, Number(step && step.attempts || 0))),
        idempotencyKey: text(step && step.idempotencyKey, 200) || run.id + ":" + index,
        acceptance: text(step && (step.acceptance || step.postcondition), 300) || postcondition(step && step.action),
        postcondition: text(step && (step.postcondition || step.acceptance), 300) || postcondition(step && step.action),
        error: text(step && step.error, 300),
      });
    });
    run.checkpoint = run.checkpoint && typeof run.checkpoint === "object" ? run.checkpoint : { nextStep: 0, completedKeys: [] };
    run.checkpoint.nextStep = Math.max(0, Math.min(run.steps.length, Number(run.checkpoint.nextStep || 0)));
    run.checkpoint.completedKeys = list(run.checkpoint.completedKeys).map(String).slice(-MAX_STEPS);
    run.taskState = run.taskState && typeof run.taskState === "object" ? run.taskState : {};
    run.taskState.goal = text(run.taskState.goal || run.intent, 1_000);
    run.taskState.verifiedFacts = list(run.taskState.verifiedFacts).map(function (fact) { return text(fact, 300); }).filter(Boolean).slice(-MAX_STEPS);
    run.taskState.unmetStepIds = run.steps.filter(function (step) { return step.status !== "succeeded"; }).map(function (step) { return step.id; });
    run.taskState.auditRound = Math.max(0, Number(run.taskState.auditRound || 0));
    run.events = list(run.events).slice(-MAX_EVENTS);
    run.planDigest = text(run.planDigest, 80) || digestActions(run.steps.map(function (step) { return step.action; }));
    run.approval = run.approval && typeof run.approval === "object" ? {
      planDigest: text(run.approval.planDigest, 80),
      approvedAt: Number(run.approval.approvedAt || 0),
      expiresAt: Number(run.approval.expiresAt || 0),
      authority: "user",
    } : null;
    run.budget = { maxSteps: MAX_STEPS, maxRetriesPerStep: 1, maxCloudCalls: 0, maxDurationMs: 10_000 };
    run.createdAt = Number(run.createdAt) || now();
    run.updatedAt = Number(run.updatedAt) || run.createdAt;
    return run;
  }

  function addEvent(run, type, detail) {
    run.events.push(event(type, detail));
    run.events = run.events.slice(-MAX_EVENTS);
    run.updatedAt = now();
  }

  function approve(raw) {
    var run = normalize(raw);
    if (!run || run.status !== "awaiting-approval") return run;
    run.status = "approved";
    run.planDigest = digestActions(run.steps.map(function (step) { return step.action; }));
    run.approval = { planDigest: run.planDigest, approvedAt: now(), expiresAt: now() + 30 * 60 * 1000, authority: "user" };
    run.steps.forEach(function (step) { if (step.status === "proposed") step.status = "ready"; });
    addEvent(run, "run.approved", "Approved by the user");
    return run;
  }

  function cancel(raw) {
    var run = normalize(raw);
    if (!run || run.status === "completed") return run;
    run.status = "cancelled";
    run.steps.forEach(function (step) { if (["proposed", "ready"].indexOf(step.status) >= 0) step.status = "cancelled"; });
    addEvent(run, "run.cancelled", "No remaining changes were applied");
    return run;
  }

  function preflight(raw) {
    var run = normalize(raw);
    var failures = [];
    if (!run) return { ok: false, failures: ["Run is missing"], run: null };
    if (["approved", "running"].indexOf(run.status) < 0) failures.push("Run is not approved");
    if (!run.approval || run.approval.authority !== "user") failures.push("User approval is missing");
    var currentDigest = digestActions(run.steps.map(function (step) { return step.action; }));
    if (!run.approval || run.approval.planDigest !== currentDigest) failures.push("Plan changed after approval");
    if (run.approval && run.approval.expiresAt && run.approval.expiresAt < now()) failures.push("Approval expired");
    if (run.steps.length > run.budget.maxSteps) failures.push("Step budget exceeded");
    if (run.steps.some(function (step) { return !actionAllowed(step.action); })) failures.push("Plan contains an unsupported action");
    if (run.steps.some(function (step) { return step.authority !== "approval-required" || step.route !== "local-action-engine" || !step.capability; })) failures.push("Unsupported authority, capability, or route");
    return { ok: failures.length === 0, failures: failures, run: run };
  }

  function executionHooks(value) {
    if (typeof value === "function") {
      return {
        execute: value,
        audit: function (_step, result) {
          return { verified: !(result && typeof result === "object" && result.verified === false), facts: [] };
        },
        compensate: null,
      };
    }
    value = value && typeof value === "object" ? value : {};
    return {
      execute: value.execute,
      audit: value.audit,
      compensate: value.compensate,
    };
  }

  function executeApproved(raw, hooksInput) {
    var checked = preflight(raw);
    var run = checked.run;
    var applied = 0;
    var hooks = executionHooks(hooksInput);
    if (typeof hooks.audit !== "function") checked.failures.push("Independent auditor is missing");
    if (!run || !checked.ok || typeof hooks.execute !== "function" || typeof hooks.audit !== "function") {
      if (run && checked.failures.length) {
        run.status = "failed";
        addEvent(run, "run.blocked", checked.failures.join("; "));
      }
      return { run: run, applied: 0, failures: checked.failures };
    }
    var startedAt = now();
    run.status = "running";
    addEvent(run, "run.started", "Local execution started");
    for (var index = run.checkpoint.nextStep; index < run.steps.length; index++) {
      var step = run.steps[index];
      if (now() - startedAt > run.budget.maxDurationMs) {
        run.status = "failed";
        addEvent(run, "run.blocked", "Execution time budget exceeded");
        break;
      }
      if (run.checkpoint.completedKeys.indexOf(step.idempotencyKey) >= 0 || step.status === "succeeded") {
        step.status = "succeeded";
        run.checkpoint.nextStep = index + 1;
        continue;
      }
      if (step.attempts > run.budget.maxRetriesPerStep) {
        step.status = "failed";
        run.status = "failed";
        addEvent(run, "step.blocked", step.title + " exceeded its retry budget");
        break;
      }
      step.status = "running";
      step.startedAt = now();
      step.attempts += 1;
      addEvent(run, "step.started", step.title);
      try {
        var executionContext = Object.freeze({
          runId: run.id,
          stepId: step.id,
          capability: step.capability,
          acceptance: step.acceptance,
          idempotencyKey: step.idempotencyKey,
          freshContext: true,
        });
        var rawResult = hooks.execute(canonical(step.action), step.idempotencyKey, executionContext);
        var result = rawResult && typeof rawResult === "object" ? Number(rawResult.applied || 0) : Number(rawResult || 0);
        if (result < 1) throw new Error("Execution produced no change");
        var audit = hooks.audit(Object.freeze({
          action: canonical(step.action),
          capability: step.capability,
          acceptance: step.acceptance,
          idempotencyKey: step.idempotencyKey,
        }), rawResult) || {};
        run.taskState.auditRound += 1;
        if (audit.verified !== true) {
          if (typeof hooks.compensate === "function") hooks.compensate(rawResult, step);
          addEvent(run, "step.compensated", step.title + " did not pass its read-only audit");
          throw new Error("Independent audit did not satisfy the acceptance criteria");
        }
        step.status = "succeeded";
        step.finishedAt = now();
        run.checkpoint.completedKeys.push(step.idempotencyKey);
        run.checkpoint.nextStep = index + 1;
        list(audit.facts).map(function (fact) { return text(fact, 300); }).filter(Boolean).forEach(function (fact) {
          if (run.taskState.verifiedFacts.indexOf(fact) < 0) run.taskState.verifiedFacts.push(fact);
        });
        run.taskState.verifiedFacts = run.taskState.verifiedFacts.slice(-MAX_STEPS);
        run.taskState.unmetStepIds = run.steps.slice(index + 1).filter(function (item) { return item.status !== "succeeded"; }).map(function (item) { return item.id; });
        applied += result;
        addEvent(run, "step.audited", step.acceptance);
      } catch (error) {
        step.status = "failed";
        step.finishedAt = now();
        step.error = text(error && error.message || error, 300);
        run.status = "failed";
        addEvent(run, "step.failed", step.title + ": " + step.error);
        break;
      }
    }
    if (run.steps.every(function (step) { return step.status === "succeeded"; })) {
      run.status = "completed";
      run.taskState.unmetStepIds = [];
      addEvent(run, "run.completed", run.steps.length + " verified step" + (run.steps.length === 1 ? "" : "s"));
    }
    return { run: run, applied: applied, failures: [] };
  }

  function receipt(raw) {
    var run = normalize(raw);
    if (!run) return null;
    return {
      id: run.id,
      status: run.status,
      completed: run.steps.filter(function (step) { return step.status === "succeeded"; }).length,
      verified: run.steps.filter(function (step) { return step.status === "succeeded" && !step.error; }).length,
      facts: run.taskState.verifiedFacts.length,
      total: run.steps.length,
      lastEvent: run.events[run.events.length - 1] || null,
      updatedAt: run.updatedAt,
    };
  }

  window.AeroHarness = {
    VERSION: VERSION,
    MAX_STEPS: MAX_STEPS,
    createRun: createRun,
    normalize: normalize,
    approve: approve,
    cancel: cancel,
    preflight: preflight,
    executeApproved: executeApproved,
    receipt: receipt,
    digestActions: digestActions,
    actionAllowed: actionAllowed,
  };
})();
