/* ============================================================
   Aero Harness v0.5
   Clean-room, model-neutral execution control for Lyfe.

   Models may propose work. This module owns the executable contract,
   approval binding, deterministic information-flow policy, bounded execution,
   read-only audit, atomic rollback, and evidence-carrying termination. It
   contains no EOS or IISc code.
   ============================================================ */
(function () {
  "use strict";

  var VERSION = "aero-harness-v0.5";
  var POLICY_VERSION = "aero-local-policy-v2";
  var CONTRACT_SCHEMA = "aero-action-contract-v2";
  var CERTIFICATE_SCHEMA = "aero-completion-certificate-v1";
  var FLOW_SCHEMA = "aero-flow-manifest-v1";
  var FLOW_POLICY_VERSION = "aero-flow-policy-v1";
  var MAX_STEPS = 12;
  var MAX_EVENTS = 180;
  var MAX_EVIDENCE_PER_STEP = 8;
  var DEFAULT_BUDGET = { maxSteps: MAX_STEPS, maxRetriesPerStep: 1, maxCloudCalls: 0, maxDurationMs: 10_000 };
  var ACTION_LABELS = {
    add_task: "Create task", complete_task: "Complete task", add_note: "Save note",
    add_doc: "Create document", log_work: "Log work", add_goal: "Create goal",
    add_education: "Add learning", add_project: "Create project",
    memory_upsert: "Remember", memory_forget: "Forget memory",
  };
  var ACTION_FIELDS = [
    "type", "title", "name", "body", "text", "why", "description", "provider",
    "kind", "area", "priority", "date", "due", "horizon", "claim", "scope",
    "memoryType", "memoryKey", "dependsOn", "supersedes", "query", "hours",
  ];
  var ALLOWED_ACTIONS = Object.keys(ACTION_LABELS);
  var FLOW_ORIGINS = ["system", "user", "workspace", "external", "model", "derived", "unknown"];
  var FLOW_SENSITIVITY = ["public", "private", "secret"];
  var FLOW_TRUST = { unknown: 0, external: 1, model: 1, derived: 2, workspace: 3, user: 4, system: 5 };

  function list(value) { return Array.isArray(value) ? value : []; }
  function text(value, max) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 500); }
  function now() { return Date.now(); }
  function id(prefix) {
    try { return prefix + "_" + crypto.randomUUID(); }
    catch (error) { return prefix + "_" + now().toString(36) + Math.random().toString(36).slice(2, 9); }
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce(function (out, key) {
      if (value[key] !== undefined) out[key] = canonical(value[key]);
      return out;
    }, {});
  }
  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  /* Synchronous SHA-256 keeps approval verification deterministic in both
     browsers and the no-dependency test runner. */
  function sha256(input) {
    var bytes = [];
    var source = String(input);
    for (var offset = 0; offset < source.length; offset++) {
      var point = source.charCodeAt(offset);
      if (point >= 0xd800 && point <= 0xdbff && offset + 1 < source.length) {
        var trail = source.charCodeAt(offset + 1);
        if (trail >= 0xdc00 && trail <= 0xdfff) {
          point = 0x10000 + ((point - 0xd800) << 10) + (trail - 0xdc00);
          offset += 1;
        }
      }
      if (point < 0x80) bytes.push(point);
      else if (point < 0x800) bytes.push(0xc0 | (point >>> 6), 0x80 | (point & 63));
      else if (point < 0x10000) bytes.push(0xe0 | (point >>> 12), 0x80 | ((point >>> 6) & 63), 0x80 | (point & 63));
      else bytes.push(0xf0 | (point >>> 18), 0x80 | ((point >>> 12) & 63), 0x80 | ((point >>> 6) & 63), 0x80 | (point & 63));
    }
    var bitLengthLow = (bytes.length << 3) >>> 0;
    var bitLengthHigh = Math.floor(bytes.length / 0x20000000) >>> 0;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push(
      (bitLengthHigh >>> 24) & 255, (bitLengthHigh >>> 16) & 255,
      (bitLengthHigh >>> 8) & 255, bitLengthHigh & 255,
      (bitLengthLow >>> 24) & 255, (bitLengthLow >>> 16) & 255,
      (bitLengthLow >>> 8) & 255, bitLengthLow & 255
    );
    var constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    var state = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var words = new Array(64);
    function rotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
    for (var block = 0; block < bytes.length; block += 64) {
      var index;
      for (index = 0; index < 16; index++) {
        var cursor = block + index * 4;
        words[index] = ((bytes[cursor] << 24) | (bytes[cursor + 1] << 16) | (bytes[cursor + 2] << 8) | bytes[cursor + 3]) >>> 0;
      }
      for (index = 16; index < 64; index++) {
        var s0 = rotate(words[index - 15], 7) ^ rotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
        var s1 = rotate(words[index - 2], 17) ^ rotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
        words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
      }
      var a = state[0], b = state[1], c = state[2], d = state[3];
      var e = state[4], f = state[5], g = state[6], h = state[7];
      for (index = 0; index < 64; index++) {
        var sum1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
        var choice = (e & f) ^ (~e & g);
        var temp1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
        var sum0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
        var majority = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (sum0 + majority) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      state[0] = (state[0] + a) >>> 0; state[1] = (state[1] + b) >>> 0;
      state[2] = (state[2] + c) >>> 0; state[3] = (state[3] + d) >>> 0;
      state[4] = (state[4] + e) >>> 0; state[5] = (state[5] + f) >>> 0;
      state[6] = (state[6] + g) >>> 0; state[7] = (state[7] + h) >>> 0;
    }
    return state.map(function (value) { return value.toString(16).padStart(8, "0"); }).join("");
  }
  function digestValue(value) { return "sha256-" + sha256(JSON.stringify(canonical(value))); }

  function actionSubject(action) {
    return text(action && (action.title || action.name || action.claim || action.query || action.text || action.body), 180) || "item";
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
    return "One matching workspace record exists.";
  }
  function issue(code, message, phase, stepId) {
    return { code: code, message: text(message, 320), phase: phase || "preflight", stepId: text(stepId, 140), at: now() };
  }
  function validateAction(action) {
    if (!action || typeof action !== "object" || Array.isArray(action)) return { ok: false, code: "ACTION_NOT_OBJECT", message: "Action must be an object" };
    var type = text(action.type, 60);
    if (ALLOWED_ACTIONS.indexOf(type) < 0) return { ok: false, code: "ACTION_UNSUPPORTED", message: "Unsupported action: " + (type || "missing type") };
    var unknown = Object.keys(action).filter(function (key) { return ACTION_FIELDS.indexOf(key) < 0; });
    if (unknown.length) return { ok: false, code: "ACTION_UNKNOWN_FIELD", message: "Action contains unsupported fields: " + unknown.join(", ") };
    var invalidValue = Object.keys(action).some(function (key) {
      if (key === "hours" || action[key] == null) return false;
      if (key === "dependsOn" || key === "supersedes") return !Array.isArray(action[key]) || action[key].some(function (value) { return typeof value !== "string" || !text(value, 101) || value.length > 100; });
      return typeof action[key] !== "string";
    });
    if (invalidValue) return { ok: false, code: "ACTION_VALUE_TYPE", message: "Action values must match the local schema" };
    if (action.hours != null && (!isFinite(Number(action.hours)) || Number(action.hours) < 0 || Number(action.hours) > 24)) return { ok: false, code: "ACTION_HOURS_RANGE", message: "Work hours must be between 0 and 24" };
    if (["date", "due", "horizon"].some(function (key) { return action[key] && !/^\d{4}-\d{2}-\d{2}$/.test(action[key]); })) return { ok: false, code: "ACTION_DATE_FORMAT", message: "Dates must use YYYY-MM-DD" };
    if (action.memoryType && ["episodic", "semantic", "project", "procedural"].indexOf(action.memoryType) < 0) return { ok: false, code: "ACTION_MEMORY_TYPE", message: "Memory type is unsupported" };
    if (list(action.dependsOn).length > 24 || list(action.supersedes).length > 12) return { ok: false, code: "ACTION_MEMORY_LINKS", message: "Memory lineage exceeds the local limit" };
    var has = function (key) { return !!text(action[key], 2_100); };
    var valid = true;
    if (["add_task", "complete_task", "add_goal", "add_education"].indexOf(type) >= 0) valid = has("title");
    else if (type === "add_project") valid = has("name") || has("title");
    else if (type === "add_note" || type === "add_doc") valid = has("title") || has("body");
    else if (type === "log_work") valid = has("text");
    else if (type === "memory_upsert") valid = has("claim");
    else if (type === "memory_forget") valid = has("query") || has("claim");
    if (!valid) return { ok: false, code: "ACTION_REQUIRED_VALUE", message: "Action is missing its target value" };
    if (Object.keys(action).some(function (key) {
      if (typeof action[key] !== "string") return false;
      return action[key].length > (["body", "text", "claim"].indexOf(key) >= 0 ? 2_000 : 240);
    })) return { ok: false, code: "ACTION_VALUE_TOO_LONG", message: "Action exceeds the local value limit" };
    return { ok: true, code: "OK", message: "Action is valid" };
  }

  /* The flow governor keeps instruction authority separate from data. A
     sanitizer may change text, but it cannot upgrade where that text came
     from. Only user and system sources can control an operation. */
  function uniqueStrings(values, max, size) {
    var seen = {};
    return list(values).map(function (value) { return text(value, size || 140); }).filter(function (value) {
      if (!value || seen[value]) return false;
      seen[value] = true; return true;
    }).slice(0, max || 64);
  }
  function normalizeFlowSource(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    var origin = FLOW_ORIGINS.indexOf(text(raw.origin, 30)) >= 0 ? text(raw.origin, 30) : "unknown";
    var sensitivity = FLOW_SENSITIVITY.indexOf(text(raw.sensitivity, 30)) >= 0 ? text(raw.sensitivity, 30) : "private";
    return {
      id: text(raw.id, 140) || "source.unknown",
      label: text(raw.label, 120) || origin,
      origin: origin,
      trust: origin,
      sensitivity: sensitivity,
      authority: origin === "user" || origin === "system" ? "control" : "data",
      sanitized: raw.sanitized === true,
    };
  }
  function sourceIndex(sources) {
    return list(sources).reduce(function (out, source) { out[source.id] = source; return out; }, {});
  }
  function joinFlowLabels(sourceIds, sources) {
    var normalizedSources = list(sources).map(normalizeFlowSource);
    var index = sourceIndex(normalizedSources);
    var selected = uniqueStrings(sourceIds, 64, 140).map(function (sourceId) { return index[sourceId]; }).filter(Boolean);
    if (!selected.length) selected = [normalizeFlowSource({ id: "source.unknown", origin: "unknown" })];
    var weakest = selected.slice().sort(function (a, b) { return FLOW_TRUST[a.trust] - FLOW_TRUST[b.trust]; })[0];
    var sensitivity = selected.some(function (source) { return source.sensitivity === "secret"; }) ? "secret"
      : selected.some(function (source) { return source.sensitivity === "private"; }) ? "private" : "public";
    return {
      sourceIds: selected.map(function (source) { return source.id; }),
      origins: uniqueStrings(selected.map(function (source) { return source.origin; }), 16, 30),
      trust: weakest.trust,
      sensitivity: sensitivity,
      authority: selected.every(function (source) { return source.authority === "control"; }) ? "control" : "data",
      sanitized: selected.some(function (source) { return source.sanitized; }),
    };
  }
  function actionAuthorizedByIntent(intent, type) {
    var value = text(intent, 2_000).toLowerCase();
    var negated = {
      add_task: /\b(?:do\s+not|don't|dont|never)\b[\s\S]{0,70}\b(?:add|create|make|schedule|turn)\b[\s\S]{0,50}\b(?:tasks?|todos?|reminders?)\b/,
      complete_task: /\b(?:do\s+not|don't|dont|never)\b[\s\S]{0,70}\b(?:complete|finish|mark|tick|check)\b/,
      add_note: /\b(?:do\s+not|don't|dont|never)\b[\s\S]{0,70}\b(?:add|create|save|write|make)\b[\s\S]{0,50}\bnotes?\b/,
      add_doc: /\b(?:do\s+not|don't|dont|never)\b[\s\S]{0,70}\b(?:add|create|save|write|make)\b[\s\S]{0,50}\b(?:docs?|documents?)\b/,
      log_work: /\b(?:do\s+not|don't|dont|never)\b[\s\S]{0,70}\b(?:log|record)\b[\s\S]{0,50}\b(?:work|hours?|time)\b/,
      add_goal: /\b(?:do\s+not|don't|dont|never)\b[\s\S]{0,70}\b(?:add|create|make|set)\b[\s\S]{0,50}\bgoals?\b/,
      add_education: /\b(?:do\s+not|don't|dont|never)\b[\s\S]{0,70}\b(?:add|create|save|track)\b[\s\S]{0,50}\b(?:course|degree|learning|skill)\b/,
      add_project: /\b(?:do\s+not|don't|dont|never)\b[\s\S]{0,70}\b(?:add|create|make|start)\b[\s\S]{0,50}\bprojects?\b/,
      memory_upsert: /\b(?:do\s+not|don't|dont|never)\b[\s\S]{0,70}\b(?:remember|memorize|save[\s\S]{0,30}memory)\b/,
      memory_forget: /\b(?:do\s+not|don't|dont|never)\b[\s\S]{0,70}\bforget\b/,
    };
    if (negated[type] && negated[type].test(value)) return false;
    var patterns = {
      add_task: /(?:^|\b)(?:task|todo|reminder)\s*:|\bremind\s+me\b|\bremember\s+to\b|\b(?:i\s+(?:need|have)\s+to|i\s+gotta|gotta)\b|\b(?:add|create|make|schedule|turn)\b[\s\S]{0,90}\b(?:tasks?|todos?|reminders?)\b/,
      complete_task: /^\s*(?:done|did|finished|completed?)\b|\b(?:complete|finish|mark|tick|check)\b[\s\S]{0,90}\b(?:task|todo|it|this|done)\b/,
      add_note: /^\s*(?:note(?:\s+down(?:\s+that)?)?|jot(?:\s+down)?)\b|\b(?:add|create|save|write|make|turn)\b[\s\S]{0,90}\bnotes?\b/,
      add_doc: /^\s*(?:doc(?:ument)?|new\s+doc|start\s+(?:a\s+)?doc)\b|\b(?:add|create|save|write|make|start|turn)\b[\s\S]{0,90}\b(?:docs?|documents?)\b/,
      log_work: /(?:^|\b)(?:worked|log|logged|spent)\b|\b(?:log|record)\b[\s\S]{0,90}\b(?:work|hours?|time)\b/,
      add_goal: /^\s*(?:goal|new\s+goal|my\s+goal\s+is(?:\s+to)?)\b|\b(?:add|create|make|set|turn)\b[\s\S]{0,90}\bgoals?\b/,
      add_education: /(?:^|\b)(?:learning|studying|course)\s*:|\b(?:i(?:'m|\s+am)\s+)?(?:learning|studying)\b|\b(?:add|create|save|track)\b[\s\S]{0,90}\b(?:courses?|degrees?|certifications?|languages?|books?|papers?|skills?|learning)\b/,
      add_project: /(?:^|\b)project\s*:|\b(?:add|create|make|start|turn)\b[\s\S]{0,90}\bprojects?\b/,
      memory_upsert: /\bremember\b(?!\s+to\b)|\bmemorize\b|^\s*learn(?:\s+that)?\b|\bteach\s+(?:aero|you)\b|\bsave\b[\s\S]{0,90}\bmemory\b/,
      memory_forget: /\bforget\b|\bstop\s+remembering\b|\bremove\b[\s\S]{0,90}\bmemory\b/,
    };
    return !!(patterns[type] && patterns[type].test(value));
  }
  function sourceMentionedByIntent(intent, source) {
    var value = text(intent, 2_000).toLowerCase();
    var idValue = text(source && source.id, 140).toLowerCase();
    var label = text(source && source.label, 120).toLowerCase();
    if (label && label.length > 2 && value.indexOf(label) >= 0) return true;
    if (/gmail/.test(idValue)) return /\b(?:gmail|email|inbox)\b/.test(value);
    if (/connect/.test(idValue)) return /\b(?:connect|thread|conversation|message)\b/.test(value);
    if (/knowledge|import|file|chatgpt|gemini/.test(idValue)) return /\b(?:knowledge|import|file|chatgpt|gemini|document)\b/.test(value);
    if (/library|note|doc|saved/.test(idValue)) return /\b(?:library|note|doc|saved)\b/.test(value);
    if (/web|browser|page|site/.test(idValue)) return /\b(?:web|browser|page|site|article)\b/.test(value);
    if (/tracking|today|workspace/.test(idValue)) return /\b(?:task|project|goal|tracking|today|workspace)\b/.test(value);
    return false;
  }
  function actionAuthorizationBudget(intent, type) {
    if (!actionAuthorizedByIntent(intent, type)) return 0;
    var value = text(intent, 2_000).toLowerCase();
    var wordNumbers = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
    var quantityNouns = {
      add_task: "(?:tasks?|todos?|reminders?)", complete_task: "(?:tasks?|todos?|items?)",
      add_note: "notes?", add_doc: "(?:docs?|documents?)", log_work: "(?:logs?|entries|sessions?)",
      add_goal: "goals?", add_education: "(?:courses?|degrees?|certifications?|skills?|items?)",
      add_project: "projects?", memory_upsert: "memories", memory_forget: "memories",
    };
    var quantityPattern = new RegExp("\\b([1-9]|1[0-2]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\s+" + quantityNouns[type] + "\\b");
    var quantity = value.match(quantityPattern);
    var explicit = quantity ? (wordNumbers[quantity[1]] || Number(quantity[1])) : 0;
    var markers = {
      add_task: /\b(?:task|todo|remind\s+me|remember\s+to|i\s+(?:need|have)\s+to)\b/g,
      complete_task: /\b(?:done|did|complete|completed|finish|finished|mark|tick|check)\b/g,
      add_note: /\b(?:note|jot\s+down)\b/g,
      add_doc: /\b(?:doc|document)\b/g,
      log_work: /\b(?:log|logged|worked|spent)\b/g,
      add_goal: /\bgoal\b/g,
      add_education: /\b(?:learning|studying|course|degree|certification|skill)\b/g,
      add_project: /\bproject\b/g,
      memory_upsert: /\b(?:remember|memorize|learn|teach)\b/g,
      memory_forget: /\b(?:forget|remove\s+memory)\b/g,
    };
    var mentions = markers[type] ? (value.match(markers[type]) || []).length : 1;
    return Math.max(1, Math.min(MAX_STEPS, explicit || mentions || 1));
  }
  function normalizeFlowManifest(raw, steps, intent) {
    raw = raw && typeof raw === "object" ? raw : {};
    var mode = raw.mode === "enforce" ? "enforce" : "legacy-trusted";
    var normalizedInput = list(raw.sources).map(normalizeFlowSource).slice(0, 48);
    var suppliedUser = normalizedInput.find(function (source) { return source.id === "turn.user"; });
    var suppliedModel = normalizedInput.find(function (source) { return source.id === "turn.model"; });
    var suppliedSystem = normalizedInput.find(function (source) { return source.id === "turn.system"; });
    var seenSources = {};
    var sources = [normalizeFlowSource({
      id: "turn.user", label: "User request", origin: "user",
      sensitivity: suppliedUser && suppliedUser.sensitivity || "private",
    })];
    seenSources["turn.user"] = true;
    if (suppliedSystem) {
      sources.push(normalizeFlowSource({ id: "turn.system", label: suppliedSystem.label || "System policy", origin: "system", sensitivity: suppliedSystem.sensitivity }));
      seenSources["turn.system"] = true;
    }
    if (suppliedModel) {
      sources.push(normalizeFlowSource({ id: "turn.model", label: suppliedModel.label || "Model output", origin: "model", sensitivity: suppliedModel.sensitivity }));
      seenSources["turn.model"] = true;
    }
    normalizedInput.forEach(function (source) {
      if (seenSources[source.id]) return;
      seenSources[source.id] = true; sources.push(source);
    });
    var known = sourceIndex(sources);
    var unresolved = false;
    function resolveSourceIds(values) {
      var result = uniqueStrings(values, 48, 140).map(function (sourceId) {
        if (known[sourceId]) return sourceId;
        unresolved = true; return "source.unknown";
      });
      if (!result.length) result = mode === "enforce" ? influences.slice() : ["turn.user"];
      return uniqueStrings(result, 48, 140);
    }
    var influences = uniqueStrings(raw.influences, 48, 140).filter(function (sourceId) { return !!known[sourceId]; });
    if (!influences.length) influences = mode === "enforce" ? sources.map(function (source) { return source.id; }) : ["turn.user"];
    var rawFields = raw.fields && typeof raw.fields === "object" && !Array.isArray(raw.fields) ? Object.assign({}, raw.fields) : {};
    if (!Object.keys(rawFields).length && raw.schema === FLOW_SCHEMA) {
      list(raw.flows).forEach(function (flow) {
        if (!flow || typeof flow !== "object") return;
        var path = text(flow.path, 220);
        if (path) rawFields[path] = list(flow.sourceIds);
      });
    }
    var controls = [];
    var flows = [];
    list(steps).forEach(function (step, stepIndex) {
      var action = step && step.action || {};
      var authorized = actionAuthorizedByIntent(intent, action.type);
      controls.push({
        stepId: text(step && step.id, 140), stepIndex: stepIndex, actionType: text(action.type, 60),
        sourceIds: authorized ? ["turn.user"] : resolveSourceIds(influences),
        sink: capabilityFor(action),
      });
      Object.keys(action).filter(function (field) { return field !== "type"; }).forEach(function (field) {
        var shortPath = stepIndex + "." + field;
        var fullPath = "steps." + stepIndex + ".action." + field;
        var supplied = rawFields[fullPath] == null ? rawFields[shortPath] : rawFields[fullPath];
        flows.push({
          stepId: text(step && step.id, 140), stepIndex: stepIndex, actionType: text(action.type, 60),
          field: text(field, 80), path: fullPath, sourceIds: resolveSourceIds(supplied), sink: capabilityFor(action),
        });
      });
    });
    if (unresolved && !known["source.unknown"]) sources.push(normalizeFlowSource({ id: "source.unknown", label: "Unresolved source", origin: "unknown", sensitivity: "private" }));
    return canonical({
      schema: FLOW_SCHEMA, policyVersion: FLOW_POLICY_VERSION, mode: mode,
      sources: sources, influences: resolveSourceIds(influences), controls: controls, flows: flows,
    });
  }
  function flowViolation(code, message, flow, sources) {
    var labels = joinFlowLabels(flow && flow.sourceIds, sources);
    var index = sourceIndex(sources);
    var from = labels.sourceIds.map(function (sourceId) { return index[sourceId] ? index[sourceId].label : sourceId; }).join(" + ") || "Unknown source";
    return {
      code: code, message: text(message, 320), stepId: text(flow && flow.stepId, 140),
      path: text(flow && (flow.path || "steps." + flow.stepIndex + ".action.type"), 220),
      sourceIds: labels.sourceIds, sink: text(flow && flow.sink, 120),
      counterexample: text(from + " -> " + (flow && (flow.field || "action type")) + " -> " + (flow && flow.sink || "denied sink"), 420),
    };
  }
  function flowDecisionFor(run) {
    var manifest = run && run.flow ? run.flow : normalizeFlowManifest(null, run && run.steps, run && run.intent);
    var violations = [];
    if (manifest.mode === "enforce") {
      var operationCounts = {};
      manifest.controls.forEach(function (control) {
        if (!actionAuthorizedByIntent(run.intent, control.actionType)) {
          violations.push(flowViolation("FLOW_CONTROL_NOT_AUTHORIZED", "The user did not authorize this operation type", control, manifest.sources));
          return;
        }
        operationCounts[control.actionType] = Number(operationCounts[control.actionType] || 0) + 1;
        if (operationCounts[control.actionType] > actionAuthorizationBudget(run.intent, control.actionType)) {
          violations.push(flowViolation("FLOW_CONTROL_CARDINALITY", "The plan contains more changes than the user authorized", control, manifest.sources));
          return;
        }
        if (joinFlowLabels(control.sourceIds, manifest.sources).authority !== "control") {
          violations.push(flowViolation("FLOW_CONTROL_FROM_DATA", "Data cannot choose an operation", control, manifest.sources));
        }
      });
      manifest.flows.forEach(function (flow) {
        var labels = joinFlowLabels(flow.sourceIds, manifest.sources);
        var sourceMap = sourceIndex(manifest.sources);
        var flowSources = labels.sourceIds.map(function (sourceId) { return sourceMap[sourceId]; }).filter(Boolean);
        var hasUnresolved = flowSources.some(function (source) { return source.origin === "unknown"; });
        var hasExternal = flowSources.some(function (source) { return source.origin === "external"; });
        if (hasUnresolved) violations.push(flowViolation("FLOW_SOURCE_UNRESOLVED", "The value has unresolved provenance", flow, manifest.sources));
        if (labels.sensitivity === "secret" && flow.sink !== "secret.vault") {
          violations.push(flowViolation("FLOW_SECRET_TO_NON_SECRET_SINK", "Secret data cannot enter this destination", flow, manifest.sources));
        }
        if (flow.actionType === "memory_upsert" && hasExternal) {
          var memoryAuthorized = actionAuthorizedByIntent(run.intent, "memory_upsert");
          var unmentioned = flowSources.filter(function (source) { return source.origin === "external" && (!memoryAuthorized || !sourceMentionedByIntent(run.intent, source)); });
          if (unmentioned.length) violations.push(flowViolation("FLOW_EXTERNAL_MEMORY_PROMOTION", "External content cannot promote itself into personal memory", flow, manifest.sources));
        }
        if (flow.actionType === "memory_forget" && hasExternal) {
          violations.push(flowViolation("FLOW_EXTERNAL_MEMORY_TARGET", "External content cannot choose a memory to forget", flow, manifest.sources));
        }
      });
    }
    var payload = {
      policyVersion: FLOW_POLICY_VERSION, manifestDigest: digestValue(manifest),
      ok: violations.length === 0, code: violations.length ? violations[0].code : "FLOW_ALLOWED",
      violations: violations,
    };
    payload.decisionDigest = digestValue(payload);
    return payload;
  }

  function event(type, detail, code) { return { id: id("evt"), type: type, code: text(code, 80), detail: text(detail, 280), at: now() }; }
  function normalizeBudget(value) {
    value = value && typeof value === "object" ? value : {};
    return {
      maxSteps: Number.isFinite(Number(value.maxSteps)) ? Number(value.maxSteps) : DEFAULT_BUDGET.maxSteps,
      maxRetriesPerStep: Number.isFinite(Number(value.maxRetriesPerStep)) ? Number(value.maxRetriesPerStep) : DEFAULT_BUDGET.maxRetriesPerStep,
      maxCloudCalls: Number.isFinite(Number(value.maxCloudCalls)) ? Number(value.maxCloudCalls) : DEFAULT_BUDGET.maxCloudCalls,
      maxDurationMs: Number.isFinite(Number(value.maxDurationMs)) ? Number(value.maxDurationMs) : DEFAULT_BUDGET.maxDurationMs,
    };
  }
  function contractFor(run) {
    return {
      schema: CONTRACT_SCHEMA, policyVersion: POLICY_VERSION,
      runId: text(run && run.id, 140), threadId: text(run && run.threadId, 120),
      episodeId: text(run && run.episodeId, 120), intent: text(run && run.intent, 1_000),
      rollbackPolicy: text(run && run.rollbackPolicy, 60), budget: normalizeBudget(run && run.budget),
      flow: canonical(run && run.flow),
      steps: list(run && run.steps).map(function (step, index) {
        return {
          id: text(step && step.id, 140), index: index, action: canonical(step && step.action),
          capability: text(step && step.capability, 120), authority: text(step && step.authority, 80),
          risk: text(step && step.risk, 80), route: text(step && step.route, 120),
          idempotencyKey: text(step && step.idempotencyKey, 200),
          acceptance: text(step && step.acceptance, 300), postcondition: text(step && step.postcondition, 300),
        };
      }),
    };
  }
  function digestContract(run) { return digestValue(contractFor(run)); }
  function approvalBindingFor(approval) {
    return {
      id: text(approval && approval.id, 140),
      contractDigest: text(approval && approval.contractDigest, 100),
      approvedAt: Number(approval && approval.approvedAt || 0),
      expiresAt: Number(approval && approval.expiresAt || 0),
      authority: text(approval && approval.authority, 80),
    };
  }
  function approvalStateFor(approval) {
    return {
      bindingDigest: text(approval && approval.bindingDigest, 100),
      consumedAt: Number(approval && approval.consumedAt || 0),
      useCount: Math.max(0, Number(approval && approval.useCount || 0)),
    };
  }
  function digestApprovalBinding(approval) { return digestValue(approvalBindingFor(approval)); }
  function digestApprovalState(approval) { return digestValue(approvalStateFor(approval)); }

  function normalizeEvidence(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var evidence = {
      type: text(raw.type, 80), source: text(raw.source, 120), ref: text(raw.ref, 220),
      claim: text(raw.claim || raw.observation, 320), observedAt: Number(raw.observedAt || 0),
    };
    if (!evidence.type || !evidence.source || !evidence.ref || !evidence.claim || !evidence.observedAt) return null;
    return evidence;
  }
  function normalizeAudit(raw) {
    if (!raw || typeof raw !== "object") return null;
    var evidence = list(raw.evidence).map(normalizeEvidence).filter(Boolean).slice(0, MAX_EVIDENCE_PER_STEP);
    return {
      verified: raw.verified === true, integrity: text(raw.integrity, 40),
      auditor: text(raw.auditor, 120) || "read-only-hook",
      facts: list(raw.facts).map(function (fact) { return text(fact, 300); }).filter(Boolean).slice(0, MAX_EVIDENCE_PER_STEP),
      evidence: evidence, evidenceDigest: evidence.length ? digestValue(evidence) : "",
      auditedAt: Number(raw.auditedAt || now()), valid: raw.valid !== false,
      invalidatedAt: Number(raw.invalidatedAt || 0),
    };
  }

  function createRun(input) {
    input = input || {};
    var runId = id("run");
    var actions = list(input.actions).slice(0, MAX_STEPS).map(canonical);
    var steps = actions.map(function (action, index) {
      var validation = validateAction(action);
      var condition = postcondition(action);
      return {
        id: id("step"), index: index,
        title: (ACTION_LABELS[action.type] || "Update workspace") + ": " + actionSubject(action),
        action: action, capability: validation.ok ? capabilityFor(action) : "",
        authority: validation.ok ? "approval-required" : "denied",
        risk: validation.ok ? "low-reversible" : "unsupported", route: "local-action-engine",
        status: "proposed", attempts: 0, idempotencyKey: runId + ":" + index,
        acceptance: condition, postcondition: condition, audit: null,
        failure: validation.ok ? null : issue(validation.code, validation.message, "plan"),
        startedAt: 0, finishedAt: 0, error: "",
      };
    });
    var run = {
      id: runId, version: VERSION, threadId: text(input.threadId, 120),
      episodeId: text(input.episodeId, 120), intent: text(input.intent, 1_000),
      status: steps.length ? "awaiting-approval" : "completed",
      rollbackPolicy: "all-or-nothing", budget: Object.assign({}, DEFAULT_BUDGET),
      contractDigest: "", planDigest: "", approval: null, steps: steps,
      flow: null, flowDecision: null,
      checkpoint: { nextStep: 0, completedKeys: [] },
      transaction: { state: steps.length ? "prepared" : "committed", policy: "all-or-nothing", appliedStepIds: [], rollbackCount: 0 },
      taskState: { goal: text(input.intent, 1_000), verifiedFacts: [], evidenceLedger: [], unmetStepIds: steps.map(function (step) { return step.id; }), auditRound: 0 },
      terminationCertificate: null, failure: null,
      events: [event("run.created", steps.length + " proposed step" + (steps.length === 1 ? "" : "s"))],
      createdAt: now(), updatedAt: now(),
    };
    run.flow = normalizeFlowManifest(input.flow, run.steps, run.intent);
    run.flowDecision = flowDecisionFor(run);
    if (!run.flowDecision.ok) {
      run.failure = issue(run.flowDecision.code, run.flowDecision.violations[0].message, "flow", run.flowDecision.violations[0].stepId);
      run.events.push(event("run.flow-blocked", run.flowDecision.violations[0].counterexample, run.flowDecision.code));
    }
    run.contractDigest = digestContract(run); run.planDigest = run.contractDigest;
    if (!steps.length) run.terminationCertificate = issueCertificate(run);
    return run;
  }

  function normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    var run = Object.assign({}, raw);
    run.id = text(raw.id, 140) || id("run"); run.version = VERSION;
    run.threadId = text(raw.threadId, 120); run.episodeId = text(raw.episodeId, 120); run.intent = text(raw.intent, 1_000);
    run.status = ["awaiting-approval", "approved", "running", "completed", "failed", "cancelled"].indexOf(raw.status) >= 0 ? raw.status : "awaiting-approval";
    run.rollbackPolicy = text(raw.rollbackPolicy, 60) || "all-or-nothing"; run.budget = normalizeBudget(raw.budget);
    run.steps = list(raw.steps).slice(0, MAX_STEPS).map(function (source, index) {
      source = source && typeof source === "object" ? source : {};
      var action = canonical(source.action || {}); var validation = validateAction(action); var condition = postcondition(action);
      return {
        id: text(source.id, 140) || id("step"), index: index,
        title: text(source.title, 260) || "Update workspace", action: action,
        capability: source.capability == null ? (validation.ok ? capabilityFor(action) : "") : text(source.capability, 120),
        authority: source.authority == null ? (validation.ok ? "approval-required" : "denied") : text(source.authority, 80),
        risk: source.risk == null ? (validation.ok ? "low-reversible" : "unsupported") : text(source.risk, 80),
        route: source.route == null ? "local-action-engine" : text(source.route, 120),
        status: ["proposed", "ready", "running", "succeeded", "failed", "rolled-back", "rollback-failed", "cancelled"].indexOf(source.status) >= 0 ? source.status : "proposed",
        attempts: Math.max(0, Math.min(3, Number(source.attempts || 0))),
        idempotencyKey: text(source.idempotencyKey, 200) || run.id + ":" + index,
        acceptance: source.acceptance == null ? text(source.postcondition, 300) || condition : text(source.acceptance, 300),
        postcondition: source.postcondition == null ? text(source.acceptance, 300) || condition : text(source.postcondition, 300),
        audit: normalizeAudit(source.audit), failure: source.failure && typeof source.failure === "object" ? source.failure : null,
        startedAt: Number(source.startedAt || 0), finishedAt: Number(source.finishedAt || 0), error: text(source.error, 300),
      };
    });
    run.checkpoint = raw.checkpoint && typeof raw.checkpoint === "object" ? Object.assign({}, raw.checkpoint) : { nextStep: 0, completedKeys: [] };
    run.checkpoint.nextStep = Math.max(0, Math.min(run.steps.length, Number(run.checkpoint.nextStep || 0)));
    run.checkpoint.completedKeys = list(run.checkpoint.completedKeys).map(String).slice(-MAX_STEPS);
    var rawTransaction = raw.transaction && typeof raw.transaction === "object" ? raw.transaction : {};
    run.transaction = {
      state: text(rawTransaction.state, 60) || (run.status === "completed" ? "committed" : "prepared"),
      policy: text(rawTransaction.policy, 60) || run.rollbackPolicy,
      appliedStepIds: list(rawTransaction.appliedStepIds).map(function (value) { return text(value, 140); }).filter(Boolean).slice(-MAX_STEPS),
      rollbackCount: Math.max(0, Number(rawTransaction.rollbackCount || 0)),
    };
    var rawState = raw.taskState && typeof raw.taskState === "object" ? raw.taskState : {};
    run.taskState = {
      goal: text(rawState.goal || run.intent, 1_000),
      verifiedFacts: list(rawState.verifiedFacts).map(function (fact) { return text(fact, 300); }).filter(Boolean).slice(-MAX_STEPS),
      evidenceLedger: list(rawState.evidenceLedger).map(canonical).slice(-MAX_STEPS),
      unmetStepIds: run.steps.filter(function (step) { return step.status !== "succeeded"; }).map(function (step) { return step.id; }),
      auditRound: Math.max(0, Number(rawState.auditRound || 0)),
    };
    run.flow = normalizeFlowManifest(raw.flow, run.steps, run.intent);
    run.flowDecision = flowDecisionFor(run);
    run.events = list(raw.events).slice(-MAX_EVENTS);
    run.contractDigest = text(raw.contractDigest || raw.planDigest, 100) || digestContract(run); run.planDigest = run.contractDigest;
    run.approval = raw.approval && typeof raw.approval === "object" ? {
      id: text(raw.approval.id, 140), contractDigest: text(raw.approval.contractDigest || raw.approval.planDigest, 100),
      planDigest: text(raw.approval.contractDigest || raw.approval.planDigest, 100),
      approvedAt: Number(raw.approval.approvedAt || 0), expiresAt: Number(raw.approval.expiresAt || 0),
      consumedAt: Number(raw.approval.consumedAt || 0), useCount: Math.max(0, Number(raw.approval.useCount || 0)),
      authority: text(raw.approval.authority, 80) || "user",
      bindingDigest: text(raw.approval.bindingDigest, 100),
      stateDigest: text(raw.approval.stateDigest, 100),
    } : null;
    run.terminationCertificate = raw.terminationCertificate && typeof raw.terminationCertificate === "object" ? canonical(raw.terminationCertificate) : null;
    run.failure = raw.failure && typeof raw.failure === "object" ? raw.failure : null;
    run.createdAt = Number(raw.createdAt) || now(); run.updatedAt = Number(raw.updatedAt) || run.createdAt;
    return run;
  }

  function addEvent(run, type, detail, code) {
    run.events.push(event(type, detail, code)); run.events = run.events.slice(-MAX_EVENTS); run.updatedAt = now();
  }
  function setFailure(run, problem, step) {
    run.failure = problem;
    if (step) { step.failure = problem; step.error = problem.message; step.finishedAt = now(); }
  }

  function approve(raw) {
    var run = normalize(raw);
    if (!run || run.status !== "awaiting-approval") return run;
    run.flowDecision = flowDecisionFor(run);
    if (!run.flowDecision.ok) {
      var violation = run.flowDecision.violations[0];
      setFailure(run, issue(violation.code, violation.message, "flow", violation.stepId));
      addEvent(run, "run.flow-blocked", violation.counterexample, violation.code);
      return run;
    }
    run.contractDigest = digestContract(run); run.planDigest = run.contractDigest;
    run.approval = {
      id: id("approval"), contractDigest: run.contractDigest, planDigest: run.contractDigest,
      approvedAt: now(), expiresAt: now() + 30 * 60 * 1000,
      consumedAt: 0, useCount: 0, authority: "user", bindingDigest: "", stateDigest: "",
    };
    run.approval.bindingDigest = digestApprovalBinding(run.approval);
    run.approval.stateDigest = digestApprovalState(run.approval);
    run.status = "approved"; run.failure = null;
    run.steps.forEach(function (step) { if (step.status === "proposed" || step.status === "rolled-back") step.status = "ready"; });
    addEvent(run, "run.approved", "Exact action contract approved by the user", "APPROVAL_BOUND");
    return run;
  }

  function cancel(raw) {
    var run = normalize(raw);
    if (!run || run.status === "completed") return run;
    run.status = "cancelled"; run.transaction.state = "cancelled";
    run.steps.forEach(function (step) { if (["proposed", "ready"].indexOf(step.status) >= 0) step.status = "cancelled"; });
    addEvent(run, "run.cancelled", "No remaining changes were applied", "USER_CANCELLED");
    return run;
  }

  function preflight(raw) {
    var run = normalize(raw); var issues = [];
    function reject(code, message, stepId) { issues.push(issue(code, message, "preflight", stepId)); }
    if (!run) return { ok: false, issues: [issue("RUN_MISSING", "Run is missing")], failures: ["Run is missing"], run: null };
    if (run.status !== "approved") reject("RUN_NOT_APPROVED", "Run is not in the approved state");
    if (!run.approval || !run.approval.id || run.approval.authority !== "user") reject("APPROVAL_MISSING", "User approval is missing");
    if (run.approval && run.approval.bindingDigest !== digestApprovalBinding(run.approval)) reject("APPROVAL_CHANGED", "Approval scope or expiry changed after consent");
    if (run.approval && run.approval.stateDigest !== digestApprovalState(run.approval)) reject("APPROVAL_STATE_CHANGED", "Approval consumption state is inconsistent");
    var currentDigest = digestContract(run);
    if (!run.approval || run.approval.contractDigest !== currentDigest || run.contractDigest !== currentDigest) reject("CONTRACT_CHANGED", "Executable contract changed after approval");
    if (run.approval && run.approval.expiresAt && run.approval.expiresAt < now()) reject("APPROVAL_EXPIRED", "Approval expired");
    if (run.approval && run.approval.useCount > 0) reject("APPROVAL_REPLAY", "Approval has already been consumed");
    run.flowDecision = flowDecisionFor(run);
    if (!run.flowDecision.ok) {
      run.flowDecision.violations.forEach(function (violation) {
        reject(violation.code, violation.message + " (" + violation.counterexample + ")", violation.stepId);
      });
    }
    if (run.rollbackPolicy !== "all-or-nothing" || run.transaction.policy !== "all-or-nothing") reject("ROLLBACK_POLICY", "Atomic rollback policy is required");
    if (JSON.stringify(run.budget) !== JSON.stringify(DEFAULT_BUDGET)) reject("BUDGET_CHANGED", "Execution budget is outside the local policy");
    if (run.steps.length > run.budget.maxSteps) reject("STEP_BUDGET", "Step budget exceeded");
    run.steps.forEach(function (step) {
      var validation = validateAction(step.action);
      if (!validation.ok) reject(validation.code, validation.message, step.id);
      if (step.authority !== "approval-required" || step.route !== "local-action-engine" || step.risk !== "low-reversible" || step.capability !== capabilityFor(step.action)) reject("CAPABILITY_CONTRACT", "Authority, capability, risk, or route is outside policy", step.id);
      if (!step.acceptance || !step.postcondition) reject("POSTCONDITION_MISSING", "A concrete postcondition is required", step.id);
      if (step.attempts > run.budget.maxRetriesPerStep) reject("RETRY_BUDGET", "Step retry budget was exhausted", step.id);
    });
    return { ok: issues.length === 0, issues: issues, failures: issues.map(function (item) { return item.message; }), run: run };
  }

  function executionHooks(value) {
    value = value && typeof value === "object" ? value : {};
    return { execute: value.execute, audit: value.audit, compensate: value.compensate };
  }
  function invalidateAudit(step) { if (step.audit) { step.audit.valid = false; step.audit.invalidatedAt = now(); } }
  function rollback(run, journal, hooks, originalProblem) {
    run.transaction.state = "rolling-back";
    addEvent(run, "transaction.rollback-started", journal.length + " applied step" + (journal.length === 1 ? "" : "s"), originalProblem.code);
    var rollbackProblems = [];
    for (var cursor = journal.length - 1; cursor >= 0; cursor--) {
      var entry = journal[cursor]; var step = run.steps[entry.index];
      try {
        var outcome = hooks.compensate(entry.result, deepFreeze({
          runId: run.id, stepId: step.id, idempotencyKey: step.idempotencyKey,
          action: canonical(step.action), contractDigest: run.contractDigest,
          flowDigest: run.flowDecision.manifestDigest, flowDecisionDigest: run.flowDecision.decisionDigest,
        }));
        if (outcome === false || (outcome && typeof outcome === "object" && outcome.compensated === false)) throw new Error("Compensation did not confirm restoration");
        step.status = "rolled-back"; invalidateAudit(step); run.transaction.rollbackCount += 1;
        addEvent(run, "step.rolled-back", step.title, "STEP_COMPENSATED");
      } catch (error) {
        step.status = "rollback-failed";
        var problem = issue("ROLLBACK_FAILED", error && error.message || error, "compensation", step.id);
        step.failure = problem; step.error = problem.message; rollbackProblems.push(problem);
        addEvent(run, "step.rollback-failed", step.title + ": " + problem.message, problem.code);
      }
    }
    run.checkpoint = { nextStep: 0, completedKeys: [] };
    run.taskState.verifiedFacts = []; run.taskState.evidenceLedger = [];
    run.taskState.unmetStepIds = run.steps.map(function (step) { return step.id; });
    run.terminationCertificate = null; run.transaction.appliedStepIds = [];
    if (rollbackProblems.length) {
      run.transaction.state = "rollback-failed"; run.status = "failed"; setFailure(run, rollbackProblems[0]);
      addEvent(run, "transaction.rollback-failed", rollbackProblems.length + " compensation failure" + (rollbackProblems.length === 1 ? "" : "s"), "ROLLBACK_FAILED");
      return rollbackProblems;
    }
    run.transaction.state = "rolled-back"; run.status = "failed"; setFailure(run, originalProblem);
    addEvent(run, "transaction.rolled-back", "All applied changes were restored", originalProblem.code);
    return [];
  }

  function issueCertificate(run) {
    var payload = {
      schema: CERTIFICATE_SCHEMA, runId: run.id, contractDigest: digestContract(run),
      evidenceDigest: digestValue(run.taskState.evidenceLedger),
      verifiedStepIds: run.steps.map(function (step) { return step.id; }),
      coverage: { verified: run.steps.length, required: run.steps.length }, issuedAt: now(),
    };
    payload.certificateDigest = digestValue(payload); return payload;
  }
  function verifyCertificate(raw) {
    var run = normalize(raw);
    if (!run || !run.terminationCertificate) return { valid: false, reason: "Certificate is missing" };
    var certificate = canonical(run.terminationCertificate);
    var suppliedDigest = text(certificate.certificateDigest, 100); delete certificate.certificateDigest;
    if (suppliedDigest !== digestValue(certificate)) return { valid: false, reason: "Certificate digest is invalid" };
    if (certificate.contractDigest !== digestContract(run)) return { valid: false, reason: "Certificate does not match the action contract" };
    if (certificate.evidenceDigest !== digestValue(run.taskState.evidenceLedger)) return { valid: false, reason: "Certificate does not match the evidence ledger" };
    if (!certificate.coverage || certificate.coverage.required !== run.steps.length || certificate.coverage.verified !== run.steps.length) return { valid: false, reason: "Certificate coverage is incomplete" };
    if (JSON.stringify(certificate.verifiedStepIds) !== JSON.stringify(run.steps.map(function (step) { return step.id; }))) return { valid: false, reason: "Certificate step coverage does not match the run" };
    var everyVerified = run.steps.every(function (step, index) {
      var entry = run.taskState.evidenceLedger[index];
      return step.status === "succeeded" && step.audit && step.audit.verified
        && step.audit.integrity === "clean" && step.audit.valid && step.audit.evidence.length > 0
        && entry && entry.stepId === step.id && entry.acceptance === step.acceptance
        && entry.auditor === step.audit.auditor && entry.evidenceDigest === step.audit.evidenceDigest
        && entry.evidenceDigest === digestValue(entry.evidence)
        && Number(entry.verifiedAt) === Number(step.audit.auditedAt);
    });
    return { valid: everyVerified, reason: everyVerified ? "Verified" : "The evidence ledger and step audits do not agree" };
  }

  function executeApproved(raw, hooksInput) {
    var checked = preflight(raw); var run = checked.run; var hooks = executionHooks(hooksInput);
    if (typeof hooks.execute !== "function") checked.issues.push(issue("EXECUTOR_MISSING", "Executor is missing", "preflight"));
    if (typeof hooks.audit !== "function") checked.issues.push(issue("AUDITOR_MISSING", "Independent auditor is missing", "preflight"));
    if (typeof hooks.compensate !== "function") checked.issues.push(issue("COMPENSATOR_MISSING", "Atomic compensation hook is missing", "preflight"));
    checked.failures = checked.issues.map(function (item) { return item.message; });
    if (!run || checked.issues.length) {
      if (run) { run.status = "failed"; setFailure(run, checked.issues[0]); addEvent(run, "run.blocked", checked.failures.join("; "), checked.issues[0].code); }
      return { run: run, applied: 0, attemptedApplied: 0, failures: checked.failures, issues: checked.issues };
    }

    var startedAt = now(); var journal = []; var attemptedApplied = 0;
    run.status = "running"; run.transaction.state = "executing";
    run.approval.useCount += 1; run.approval.consumedAt = now();
    run.approval.stateDigest = digestApprovalState(run.approval);
    addEvent(run, "run.started", "Bounded local transaction started", "TRANSACTION_STARTED");

    for (var index = 0; index < run.steps.length; index++) {
      var step = run.steps[index]; var problem = null;
      if (now() - startedAt > run.budget.maxDurationMs) problem = issue("DURATION_BUDGET", "Execution time budget exceeded", "execution", step.id);
      else if (step.attempts > run.budget.maxRetriesPerStep) problem = issue("RETRY_BUDGET", "Step retry budget was exhausted", "execution", step.id);
      if (problem) {
        step.status = "failed"; setFailure(run, problem, step); addEvent(run, "step.failed", step.title + ": " + problem.message, problem.code);
        rollback(run, journal, hooks, problem); break;
      }
      step.status = "running"; step.startedAt = now(); step.attempts += 1; step.failure = null; step.error = "";
      addEvent(run, "step.started", step.title, "STEP_STARTED");
      try {
        var executionContext = deepFreeze({
          runId: run.id, stepId: step.id, capability: step.capability,
          acceptance: step.acceptance, idempotencyKey: step.idempotencyKey,
          contractDigest: run.contractDigest, flowDigest: run.flowDecision.manifestDigest,
          flowDecisionDigest: run.flowDecision.decisionDigest,
          attempt: step.attempts, freshContext: true,
        });
        var rawResult = hooks.execute(deepFreeze(canonical(step.action)), step.idempotencyKey, executionContext);
        var changed = rawResult && typeof rawResult === "object" ? Number(rawResult.applied || 0) : Number(rawResult || 0);
        if (!Number.isFinite(changed) || changed < 1) throw issue("NO_CHANGE", "Execution produced no change", "execution", step.id);
        journal.push({ index: index, result: rawResult }); attemptedApplied += changed;
        if (digestContract(run) !== run.contractDigest) throw issue("CONTRACT_MUTATED", "Action contract changed during execution", "execution", step.id);
        var auditRaw = hooks.audit(deepFreeze({
          runId: run.id, stepId: step.id, action: canonical(step.action), capability: step.capability,
          acceptance: step.acceptance, idempotencyKey: step.idempotencyKey, contractDigest: run.contractDigest,
          flowDigest: run.flowDecision.manifestDigest, flowDecisionDigest: run.flowDecision.decisionDigest,
        }), rawResult) || {};
        run.taskState.auditRound += 1;
        var audit = normalizeAudit(Object.assign({}, auditRaw, { auditedAt: now(), valid: true }));
        if (!audit || audit.verified !== true) throw issue("AUDIT_FAILED", "Independent audit did not satisfy the acceptance criteria", "audit", step.id);
        if (audit.integrity !== "clean") throw issue("AUDIT_INTEGRITY", "Auditor could not establish a clean observation", "audit", step.id);
        if (!audit.evidence.length || audit.evidence.length !== list(auditRaw.evidence).length) throw issue("EVIDENCE_MISSING", "Structured evidence is required for completion", "audit", step.id);
        if (audit.evidence.some(function (item) { return item.observedAt < step.startedAt - 1_000 || item.observedAt > now() + 1_000; })) throw issue("EVIDENCE_TIME", "Audit evidence is stale or future-dated", "audit", step.id);
        if (digestContract(run) !== run.contractDigest) throw issue("CONTRACT_MUTATED", "Action contract changed during audit", "audit", step.id);
        step.audit = audit; step.status = "succeeded"; step.finishedAt = now();
        run.checkpoint.completedKeys.push(step.idempotencyKey); run.checkpoint.nextStep = index + 1;
        run.transaction.appliedStepIds.push(step.id);
        audit.facts.forEach(function (fact) { if (run.taskState.verifiedFacts.indexOf(fact) < 0) run.taskState.verifiedFacts.push(fact); });
        run.taskState.verifiedFacts = run.taskState.verifiedFacts.slice(-MAX_STEPS);
        run.taskState.evidenceLedger.push({ stepId: step.id, acceptance: step.acceptance, auditor: audit.auditor, evidenceDigest: audit.evidenceDigest, evidence: audit.evidence, verifiedAt: audit.auditedAt });
        run.taskState.unmetStepIds = run.steps.slice(index + 1).map(function (item) { return item.id; });
        addEvent(run, "step.audited", step.acceptance, "EVIDENCE_ACCEPTED");
      } catch (error) {
        problem = error && error.code ? error : issue("EXECUTION_FAILED", error && error.message || error, "execution", step.id);
        step.status = "failed"; setFailure(run, problem, step);
        addEvent(run, "step.failed", step.title + ": " + problem.message, problem.code);
        rollback(run, journal, hooks, problem); break;
      }
    }

    if (run.steps.length && run.steps.every(function (step) { return step.status === "succeeded" && step.audit && step.audit.verified && step.audit.integrity === "clean" && step.audit.valid && step.audit.evidence.length > 0; })) {
      run.taskState.unmetStepIds = []; run.terminationCertificate = issueCertificate(run);
      var certificateCheck = verifyCertificate(Object.assign({}, run, { status: "running" }));
      if (certificateCheck.valid) {
        run.status = "completed"; run.transaction.state = "committed"; run.failure = null;
        addEvent(run, "run.completed", run.steps.length + " evidence-backed step" + (run.steps.length === 1 ? "" : "s"), "CERTIFIED_COMPLETE");
      } else {
        problem = issue("CERTIFICATE_INVALID", certificateCheck.reason, "termination"); rollback(run, journal, hooks, problem);
      }
    }
    return {
      run: run, applied: run.status === "completed" ? attemptedApplied : 0, attemptedApplied: attemptedApplied,
      failures: run.status === "failed" && run.failure ? [run.failure.message] : [],
      issues: run.status === "failed" && run.failure ? [run.failure] : [],
    };
  }

  function retry(raw) {
    var run = normalize(raw);
    if (!run || run.status !== "failed" || run.transaction.state !== "rolled-back") return run;
    if (run.steps.some(function (step) { return step.attempts > run.budget.maxRetriesPerStep; })) {
      setFailure(run, issue("RETRY_BUDGET", "Retry budget is exhausted", "recovery")); return run;
    }
    run.status = "awaiting-approval"; run.transaction.state = "prepared"; run.approval = null;
    run.failure = null; run.terminationCertificate = null;
    run.steps.forEach(function (step) { step.status = "proposed"; step.failure = null; step.error = ""; step.audit = null; });
    run.contractDigest = digestContract(run); run.planDigest = run.contractDigest;
    addEvent(run, "run.retry-requested", "Restored transaction requires fresh approval", "FRESH_APPROVAL_REQUIRED");
    return run;
  }

  function receipt(raw) {
    var run = normalize(raw); if (!run) return null;
    var certificate = verifyCertificate(run);
    return {
      id: run.id, status: run.status,
      completed: run.steps.filter(function (step) { return step.status === "succeeded"; }).length,
      verified: run.steps.filter(function (step) { return step.status === "succeeded" && step.audit && step.audit.verified && step.audit.integrity === "clean" && step.audit.valid; }).length,
      facts: run.taskState.verifiedFacts.length, evidence: run.taskState.evidenceLedger.length,
      total: run.steps.length, atomic: run.transaction.state === "committed" || run.transaction.state === "rolled-back",
      flow: { ok: run.flowDecision.ok, code: run.flowDecision.code, violations: run.flowDecision.violations.length },
      certified: certificate.valid, lastEvent: run.events[run.events.length - 1] || null, updatedAt: run.updatedAt,
    };
  }

  window.AeroHarness = {
    VERSION: VERSION, POLICY_VERSION: POLICY_VERSION, FLOW_SCHEMA: FLOW_SCHEMA,
    FLOW_POLICY_VERSION: FLOW_POLICY_VERSION, MAX_STEPS: MAX_STEPS,
    createRun: createRun, normalize: normalize, approve: approve, cancel: cancel,
    preflight: preflight, executeApproved: executeApproved, retry: retry,
    receipt: receipt, verifyCertificate: verifyCertificate,
    digestActions: function (actions) { return digestValue(list(actions).map(canonical)); },
    digestContract: digestContract, digestValue: digestValue,
    validateAction: validateAction, actionAllowed: actionAllowed,
    normalizeFlowManifest: normalizeFlowManifest, flowDecisionFor: flowDecisionFor,
    joinFlowLabels: joinFlowLabels, actionAuthorizedByIntent: actionAuthorizedByIntent,
    actionAuthorizationBudget: actionAuthorizationBudget,
  };
})();
