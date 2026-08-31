/* ============================================================
   Aero longitudinal evaluation v0.2

   A privacy-preserving, model-neutral evaluator for Aero's product
   promise: one person should be able to communicate less over time
   without losing intent accuracy.

   This is clean-room Sonne Systems product code. It contains no EOS,
   IISc, unpublished research code, or user prompt content in its keys.
   ============================================================ */
(function (root) {
  "use strict";

  var VERSION = "aero-eval-v0.2";
  var POSITIVE_OUTCOMES = ["helpful", "accepted"];
  var NEGATIVE_OUTCOMES = ["missed", "rejected", "undone"];
  var PHASES = ["baseline", "adapted", "holdout"];
  var KINDS = ["action", "response", "proactive"];
  var VERIFICATIONS = ["environment", "user", "local", "synthetic", "none"];

  function list(value) { return Array.isArray(value) ? value : []; }

  function text(value, max) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 240);
  }

  function bounded(value, minimum, maximum, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = Number(fallback || 0);
    return Math.max(minimum, Math.min(maximum, number));
  }

  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce(function (out, key) {
      if (value[key] !== undefined) out[key] = canonical(value[key]);
      return out;
    }, {});
  }

  function fingerprint(value) {
    var input = JSON.stringify(canonical(value));
    var hash = 2166136261;
    for (var index = 0; index < input.length; index++) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function countWords(value) {
    var matches = text(value, 4_000).match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
    return matches ? matches.length : 0;
  }

  function normalizedSubject(value) {
    var result = text(value, 300).toLowerCase()
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
      .replace(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g, " ")
      .replace(/\b(?:today|tomorrow|tonight|yesterday|next week|this week)\b/g, " ")
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/g, " ")
      .replace(/\b\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?)\b/g, " ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ").trim();
    return result || "variable";
  }

  function actionSubject(action) {
    action = action && typeof action === "object" ? action : {};
    var type = text(action.type, 60).toLowerCase();
    if (type === "add_task") return normalizedSubject(action.title);
    if (type === "complete_task") return normalizedSubject(action.id || action.taskId || action.title);
    if (type === "add_note" || type === "add_doc") return normalizedSubject(action.title);
    if (type === "log_work") return normalizedSubject(action.projectId || action.project || action.title);
    if (type === "add_goal" || type === "add_education" || type === "add_project") {
      return normalizedSubject(action.title || action.name);
    }
    if (type === "memory_upsert") return normalizedSubject(action.memoryKey || action.claim);
    if (type === "memory_forget") return normalizedSubject(action.memoryId || action.memoryKey || action.claim);
    return normalizedSubject(action.id || action.title || action.name || type);
  }

  function routineKeyForActions(actions, salt) {
    var contract = list(actions).slice(0, 16).map(function (action) {
      return {
        type: text(action && action.type, 60).toLowerCase(),
        subject: actionSubject(action),
      };
    }).filter(function (item) { return item.type; });
    var secret = text(salt, 160);
    if (!contract.length || !secret || !(root.AeroHarness && typeof root.AeroHarness.digestValue === "function")) return "";
    return "routine-" + root.AeroHarness.digestValue({ salt: secret, contract: contract }).replace(/^sha256-/, "");
  }

  function normalizeStudy(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    var taskKey = text(value.taskKey || value.routineKey, 120).toLowerCase();
    if (!/^routine-[0-9a-f]{64}$/.test(taskKey) && !/^study-[a-z0-9][a-z0-9_-]{2,119}$/.test(taskKey)) return null;
    var kind = KINDS.indexOf(value.kind) >= 0 ? value.kind : "action";
    var phase = PHASES.indexOf(value.phase) >= 0 ? value.phase : "baseline";
    var verification = VERIFICATIONS.indexOf(value.verification) >= 0 ? value.verification : "none";
    var authorityId = text(value.authorityId, 120).toLowerCase();
    var certificateDigest = text(value.certificateDigest, 80).toLowerCase();
    var expected = Math.round(bounded(value.expectedConstraints, 0, 100, kind === "action" ? 1 : 0));
    var satisfied = Math.round(bounded(value.satisfiedConstraints, 0, expected, 0));
    return {
      version: 1,
      taskKey: taskKey,
      kind: kind,
      phase: phase,
      verification: verification,
      authorityId: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(authorityId) ? authorityId : "",
      certificateDigest: /^[0-9a-f]{64}$/.test(certificateDigest) ? certificateDigest : "",
      expectedConstraints: expected,
      satisfiedConstraints: satisfied,
      followupWords: Math.round(bounded(value.followupWords, 0, 4_000, 0)),
      clarificationTurns: Math.round(bounded(value.clarificationTurns, 0, 50, 0)),
      correctionTurns: Math.round(bounded(value.correctionTurns, 0, 50, 0)),
      stalePreferenceViolation: value.stalePreferenceViolation === true,
      preferenceRevision: Math.round(bounded(value.preferenceRevision, 0, Number.MAX_SAFE_INTEGER, 0)),
      synthetic: value.synthetic === true || verification === "synthetic",
    };
  }

  function studyForAction(options) {
    options = options || {};
    var actions = list(options.actions);
    var taskKey = routineKeyForActions(actions, options.salt);
    if (!taskKey) return null;
    var execution = text(options.execution, 80).toLowerCase();
    var authorityId = text(options.authorityId, 120).toLowerCase();
    var certificateDigest = text(options.certificateDigest, 80).toLowerCase();
    var receiptBound = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(authorityId)
      && /^[0-9a-f]{64}$/.test(certificateDigest);
    var verification = /server-(?:memory-)?atomic/.test(execution) && receiptBound ? "environment"
      : options.synthetic === true ? "synthetic" : "local";
    var prior = list(options.episodes).some(function (episode) {
      var study = normalizeStudy(episode && episode.study);
      var priorNegative = NEGATIVE_OUTCOMES.indexOf(episode && episode.outcome) >= 0;
      var priorPositive = POSITIVE_OUTCOMES.indexOf(episode && episode.outcome) >= 0;
      var priorReceipt = study && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(study.authorityId)
        && /^[0-9a-f]{64}$/.test(study.certificateDigest);
      var priorProduction = priorNegative || (priorPositive && study && study.verification === "environment" && priorReceipt);
      return study && study.taskKey === taskKey && study.phase !== "holdout"
        && (verification === "environment" ? priorProduction : (priorNegative || priorPositive));
    });
    return normalizeStudy({
      taskKey: taskKey,
      kind: "action",
      phase: prior ? "adapted" : "baseline",
      verification: verification,
      authorityId: authorityId,
      certificateDigest: certificateDigest,
      expectedConstraints: actions.length,
      satisfiedConstraints: bounded(options.applied, 0, actions.length, 0),
      followupWords: options.followupWords,
      clarificationTurns: options.clarificationTurns,
      correctionTurns: options.correctionTurns,
      stalePreferenceViolation: options.stalePreferenceViolation,
      preferenceRevision: options.preferenceRevision,
      synthetic: options.synthetic,
    });
  }

  function normalizeTrial(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    var study = normalizeStudy(value.study || value);
    var outcome = text(value.outcome, 30).toLowerCase();
    if (!study || POSITIVE_OUTCOMES.concat(NEGATIVE_OUTCOMES).indexOf(outcome) < 0) return null;
    var userWords = Math.round(bounded(value.userWords == null ? value.wordCount : value.userWords, 0, 4_000, 0));
    var positive = POSITIVE_OUTCOMES.indexOf(outcome) >= 0;
    var negative = NEGATIVE_OUTCOMES.indexOf(outcome) >= 0;
    var constraintConsistent = study.expectedConstraints === 0
      ? positive : study.satisfiedConstraints === study.expectedConstraints;
    var positiveVerification = study.kind === "action"
      ? study.verification === "environment"
      : study.verification === "environment" || study.verification === "user";
    var receiptBound = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(study.authorityId)
      && /^[0-9a-f]{64}$/.test(study.certificateDigest);
    var releaseScorable = !study.synthetic && /^routine-[0-9a-f]{64}$/.test(study.taskKey)
      && (negative || (positiveVerification && receiptBound));
    var verifiedSuccess = positive && positiveVerification && constraintConsistent
      && !study.stalePreferenceViolation;
    var firstPass = verifiedSuccess && study.clarificationTurns === 0 && study.correctionTurns === 0;
    return {
      id: text(value.id, 120) || "trial-" + fingerprint([study.taskKey, value.createdAt, outcome, userWords]),
      taskKey: study.taskKey,
      phase: study.phase,
      kind: study.kind,
      outcome: outcome,
      verification: study.verification,
      authorityId: study.authorityId,
      certificateDigest: study.certificateDigest,
      createdAt: Math.max(1, Number(value.createdAt || Date.now())),
      userWords: userWords,
      followupWords: study.followupWords,
      communicationWords: userWords + study.followupWords,
      clarificationTurns: study.clarificationTurns,
      correctionTurns: study.correctionTurns,
      expectedConstraints: study.expectedConstraints,
      satisfiedConstraints: study.satisfiedConstraints,
      constraintConsistent: constraintConsistent,
      stalePreferenceViolation: study.stalePreferenceViolation,
      preferenceRevision: study.preferenceRevision,
      synthetic: study.synthetic,
      releaseScorable: releaseScorable,
      success: verifiedSuccess,
      firstPass: firstPass,
    };
  }

  function fromEpisodes(episodes) {
    return list(episodes).map(function (episode) {
      return normalizeTrial({
        id: episode && episode.id,
        study: episode && episode.study,
        outcome: episode && episode.outcome,
        wordCount: episode && episode.wordCount,
        createdAt: episode && episode.createdAt,
      });
    }).filter(Boolean);
  }

  function pairTrials(trials) {
    var groups = {};
    list(trials).slice().sort(function (left, right) { return left.createdAt - right.createdAt; }).forEach(function (trial) {
      if (!groups[trial.taskKey]) groups[trial.taskKey] = [];
      groups[trial.taskKey].push(trial);
    });
    var pairs = [];
    Object.keys(groups).forEach(function (taskKey) {
      var baseline = null;
      groups[taskKey].forEach(function (trial) {
        if (trial.phase === "baseline") {
          baseline = trial;
          return;
        }
        if (trial.phase === "adapted" && baseline && trial.createdAt >= baseline.createdAt) {
          pairs.push({ taskKey: taskKey, baseline: baseline, adapted: trial });
        }
      });
    });
    return pairs;
  }

  function average(values) {
    return values.length ? values.reduce(function (sum, value) { return sum + Number(value || 0); }, 0) / values.length : 0;
  }

  function median(values) {
    if (!values.length) return 0;
    var sorted = values.slice().sort(function (left, right) { return left - right; });
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function rate(items, predicate) {
    return items.length ? items.filter(predicate).length / items.length : null;
  }

  function wilsonLower(successes, total, z) {
    if (!total) return null;
    z = Number(z || 1.6448536269514722); // one-sided 95%
    var p = successes / total;
    var z2 = z * z;
    var denominator = 1 + z2 / total;
    var centre = p + z2 / (2 * total);
    var margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
    return Math.max(0, (centre - margin) / denominator);
  }

  function day(value) {
    try { return new Date(value).toISOString().slice(0, 10); }
    catch (error) { return ""; }
  }

  function evaluate(trials, options) {
    options = options || {};
    var duplicateTrialIds = 0;
    var duplicateReceipts = 0;
    var seenTrialIds = new Set();
    var seenReceipts = new Set();
    var normalized = list(trials).map(normalizeTrial).filter(Boolean).filter(function (trial) {
      if (seenTrialIds.has(trial.id)) {
        duplicateTrialIds += 1;
        return false;
      }
      seenTrialIds.add(trial.id);
      if (trial.releaseScorable && POSITIVE_OUTCOMES.indexOf(trial.outcome) >= 0) {
        var receiptKey = trial.authorityId + ":" + trial.certificateDigest;
        if (seenReceipts.has(receiptKey)) {
          duplicateReceipts += 1;
          trial.releaseScorable = false;
        } else {
          seenReceipts.add(receiptKey);
        }
      }
      return true;
    });
    var directionalPairs = pairTrials(normalized);
    var releasePairs = pairTrials(normalized.filter(function (trial) { return trial.releaseScorable; }));
    var pairs = releasePairs;
    var baseline = pairs.map(function (pair) { return pair.baseline; });
    var adapted = pairs.map(function (pair) { return pair.adapted; });
    var routinePairs = {};
    pairs.forEach(function (pair) {
      if (!routinePairs[pair.taskKey]) routinePairs[pair.taskKey] = [];
      routinePairs[pair.taskKey].push(pair);
    });
    var routineKeys = Object.keys(routinePairs);
    var routineSummaries = routineKeys.map(function (key) {
      var matched = routinePairs[key];
      var routineBaseline = matched[0].baseline;
      var routineAdapted = matched.map(function (pair) { return pair.adapted; });
      var routineBaselineWords = routineBaseline.communicationWords;
      var routineAdaptedWords = average(routineAdapted.map(function (trial) { return trial.communicationWords; }));
      var routineExpected = routineAdapted.reduce(function (sum, trial) { return sum + trial.expectedConstraints; }, 0);
      var routineSatisfied = routineAdapted.reduce(function (sum, trial) { return sum + trial.satisfiedConstraints; }, 0);
      var reliable = routineAdapted.length > 0 && routineAdapted.every(function (trial) { return trial.firstPass; });
      return {
        taskKey: key,
        repeats: routineAdapted.length,
        baselineWords: routineBaselineWords,
        adaptedWords: routineAdaptedWords,
        compression: routineBaselineWords > 0 ? 1 - routineAdaptedWords / routineBaselineWords : null,
        baselineFirstPass: routineBaseline.firstPass,
        adaptedFirstPassRate: rate(routineAdapted, function (trial) { return trial.firstPass; }),
        reliable: reliable,
        expectedConstraints: routineExpected,
        satisfiedConstraints: routineSatisfied,
        constraintConsistency: routineExpected ? routineSatisfied / routineExpected : null,
        baselineClarificationTurns: routineBaseline.clarificationTurns,
        adaptedClarificationTurns: average(routineAdapted.map(function (trial) { return trial.clarificationTurns; })),
        baselineCorrectionTurns: routineBaseline.correctionTurns,
        adaptedCorrectionTurns: average(routineAdapted.map(function (trial) { return trial.correctionTurns; })),
      };
    });
    var baselineWords = routineSummaries.length
      ? average(routineSummaries.map(function (routine) { return routine.baselineWords; })) : 0;
    var adaptedWords = routineSummaries.length
      ? average(routineSummaries.map(function (routine) { return routine.adaptedWords; })) : 0;
    var routineCompression = routineSummaries.map(function (routine) { return routine.compression; })
      .filter(function (value) { return value != null; });
    var baselineAccuracy = routineSummaries.length
      ? average(routineSummaries.map(function (routine) { return routine.baselineFirstPass ? 1 : 0; })) : null;
    var adaptedAccuracy = routineSummaries.length
      ? average(routineSummaries.map(function (routine) { return routine.adaptedFirstPassRate; })) : null;
    var accuracyDelta = baselineAccuracy == null || adaptedAccuracy == null ? null : adaptedAccuracy - baselineAccuracy;
    var negativeTransfers = routineSummaries.filter(function (routine) {
      return routine.baselineFirstPass && !routine.reliable;
    }).length;
    var positiveTransfers = routineSummaries.filter(function (routine) {
      return !routine.baselineFirstPass && routine.reliable;
    }).length;
    var expectedConstraints = adapted.reduce(function (sum, trial) { return sum + trial.expectedConstraints; }, 0);
    var satisfiedConstraints = adapted.reduce(function (sum, trial) { return sum + trial.satisfiedConstraints; }, 0);
    var uniqueTasks = new Set(routineKeys);
    var reliableRoutines = routineSummaries.filter(function (routine) { return routine.reliable; }).length;
    var uniqueDays = new Set(pairs.flatMap(function (pair) { return [day(pair.baseline.createdAt), day(pair.adapted.createdAt)]; }).filter(Boolean));
    var compression = routineCompression.length ? average(routineCompression) : null;
    var adaptedSuccesses = adapted.filter(function (trial) { return trial.firstPass; }).length;
    var lowerBound = wilsonLower(adaptedSuccesses, adapted.length);
    var routineLowerBound = wilsonLower(reliableRoutines, routineKeys.length);
    var thresholds = {
      pairs: Math.max(1, Number(options.minimumPairs || 30)),
      tasks: Math.max(1, Number(options.minimumTasks || 12)),
      repeatsPerRoutine: Math.max(1, Number(options.minimumRepeatsPerRoutine || 2)),
      days: Math.max(1, Number(options.minimumDays || 7)),
      compression: Number(options.minimumCompression == null ? 0.25 : options.minimumCompression),
      medianCompression: Number(options.minimumMedianCompression == null ? 0.20 : options.minimumMedianCompression),
      accuracy: Number(options.minimumAccuracy == null ? 0.90 : options.minimumAccuracy),
      accuracyDelta: Number(options.minimumAccuracyDelta == null ? -0.05 : options.minimumAccuracyDelta),
      accuracyLowerBound: Number(options.minimumAccuracyLowerBound == null ? 0.80 : options.minimumAccuracyLowerBound),
      constraintConsistency: Number(options.minimumConstraintConsistency == null ? 0.95 : options.minimumConstraintConsistency),
      negativeTransfer: Number(options.maximumNegativeTransfer == null ? 0.05 : options.maximumNegativeTransfer),
    };
    var constraintRates = routineSummaries.map(function (routine) { return routine.constraintConsistency; })
      .filter(function (value) { return value != null; });
    var constraintConsistency = constraintRates.length ? average(constraintRates) : null;
    var negativeTransferRate = routineSummaries.length ? negativeTransfers / routineSummaries.length : null;
    var staleViolations = adapted.filter(function (trial) { return trial.stalePreferenceViolation; }).length;
    var minimumRepeatsObserved = routineSummaries.length
      ? Math.min.apply(null, routineSummaries.map(function (routine) { return routine.repeats; })) : 0;
    var underSampledRoutines = routineSummaries.filter(function (routine) {
      return routine.repeats < thresholds.repeatsPerRoutine;
    }).length;
    var gates = [
      { id: "matched-pairs", pass: pairs.length >= thresholds.pairs, value: pairs.length, target: thresholds.pairs },
      { id: "routine-coverage", pass: uniqueTasks.size >= thresholds.tasks, value: uniqueTasks.size, target: thresholds.tasks },
      { id: "routine-repeats", pass: routineSummaries.length > 0 && underSampledRoutines === 0, value: minimumRepeatsObserved, target: thresholds.repeatsPerRoutine },
      { id: "day-coverage", pass: uniqueDays.size >= thresholds.days, value: uniqueDays.size, target: thresholds.days },
      { id: "mean-compression", pass: compression != null && compression >= thresholds.compression, value: compression, target: thresholds.compression },
      { id: "median-compression", pass: routineCompression.length > 0 && median(routineCompression) >= thresholds.medianCompression, value: median(routineCompression), target: thresholds.medianCompression },
      { id: "adapted-accuracy", pass: adaptedAccuracy != null && adaptedAccuracy >= thresholds.accuracy, value: adaptedAccuracy, target: thresholds.accuracy },
      { id: "accuracy-non-inferiority", pass: accuracyDelta != null && accuracyDelta >= thresholds.accuracyDelta, value: accuracyDelta, target: thresholds.accuracyDelta },
      { id: "routine-confidence", pass: routineLowerBound != null && routineLowerBound >= thresholds.accuracyLowerBound, value: routineLowerBound, target: thresholds.accuracyLowerBound },
      { id: "constraint-consistency", pass: constraintConsistency != null && constraintConsistency >= thresholds.constraintConsistency, value: constraintConsistency, target: thresholds.constraintConsistency },
      { id: "negative-transfer", pass: negativeTransferRate != null && negativeTransferRate <= thresholds.negativeTransfer, value: negativeTransferRate, target: thresholds.negativeTransfer },
      { id: "stale-state", pass: staleViolations === 0 && adapted.length > 0, value: staleViolations, target: 0 },
      { id: "unique-evidence", pass: duplicateTrialIds === 0 && duplicateReceipts === 0, value: duplicateTrialIds + duplicateReceipts, target: 0 },
    ];
    var evidenceReady = gates.every(function (gate) { return gate.pass; });
    var status = evidenceReady ? "release-evidence" : (directionalPairs.length ? "directional" : "insufficient");
    return {
      version: VERSION,
      status: status,
      evidenceReady: evidenceReady,
      trials: normalized.length,
      directionalPairs: directionalPairs.length,
      releasePairs: pairs.length,
      taskKeys: uniqueTasks.size,
      minimumRepeatsPerRoutine: minimumRepeatsObserved,
      underSampledRoutines: underSampledRoutines,
      distinctDays: uniqueDays.size,
      baselineWords: baselineWords,
      adaptedWords: adaptedWords,
      compression: compression,
      medianCompression: routineCompression.length ? median(routineCompression) : null,
      baselineFirstPassRate: baselineAccuracy,
      adaptedFirstPassRate: adaptedAccuracy,
      intentAccuracyDelta: accuracyDelta,
      adaptedAccuracyLower95: lowerBound,
      reliableRoutines: reliableRoutines,
      routineReliability: routineKeys.length ? reliableRoutines / routineKeys.length : null,
      routineReliabilityLower95: routineLowerBound,
      expectedConstraints: expectedConstraints,
      satisfiedConstraints: satisfiedConstraints,
      constraintConsistency: constraintConsistency,
      negativeTransfers: negativeTransfers,
      positiveTransfers: positiveTransfers,
      negativeTransferRate: negativeTransferRate,
      stalePreferenceViolations: staleViolations,
      duplicateTrialIds: duplicateTrialIds,
      duplicateReceipts: duplicateReceipts,
      baselineClarificationTurns: routineSummaries.length ? average(routineSummaries.map(function (routine) { return routine.baselineClarificationTurns; })) : 0,
      adaptedClarificationTurns: routineSummaries.length ? average(routineSummaries.map(function (routine) { return routine.adaptedClarificationTurns; })) : 0,
      baselineCorrectionTurns: routineSummaries.length ? average(routineSummaries.map(function (routine) { return routine.baselineCorrectionTurns; })) : 0,
      adaptedCorrectionTurns: routineSummaries.length ? average(routineSummaries.map(function (routine) { return routine.adaptedCorrectionTurns; })) : 0,
      gates: gates,
    };
  }

  root.AeroEval = {
    VERSION: VERSION,
    countWords: countWords,
    routineKeyForActions: routineKeyForActions,
    normalizeStudy: normalizeStudy,
    studyForAction: studyForAction,
    normalizeTrial: normalizeTrial,
    fromEpisodes: fromEpisodes,
    pairTrials: pairTrials,
    wilsonLower: wilsonLower,
    evaluate: evaluate,
  };
})(typeof window !== "undefined" ? window : globalThis);
