/*
 * Pure protocol core for Aero's signed-in Lyfe execution route.
 *
 * This module has no network, Supabase, or provider dependency. The Edge
 * Function supplies an authenticated account and its current Lyfe document;
 * this code closes the action schema, binds the contract to that exact state,
 * and materializes one deterministic target for an atomic database commit.
 */

export const PROTOCOL_VERSION = "aero-supabase-v0.1";
export const SUPPORTED_ACTIONS = Object.freeze([
  "add_task",
  "complete_task",
  "add_note",
  "add_doc",
  "log_work",
  "add_goal",
  "add_education",
  "add_project",
]);

const COLLECTIONS = Object.freeze([
  "tasks", "notes", "docs", "worklog", "goals", "education", "projects",
]);
const ACTION_FIELDS = Object.freeze([
  "type", "title", "name", "body", "text", "why", "description", "provider",
  "kind", "area", "priority", "date", "due", "horizon", "hours",
]);
const AREAS = Object.freeze(["Work", "Research", "Education", "Personal", "Health", "Other"]);
const PRIORITIES = Object.freeze(["High", "Medium", "Low"]);
const EDUCATION_KINDS = Object.freeze([
  "Course", "Degree", "Certification", "Language", "Book", "Paper", "Skill", "Other",
]);
const CAPABILITIES = Object.freeze({
  add_task: "lyfe.tasks.create",
  complete_task: "lyfe.tasks.complete",
  add_note: "lyfe.library.note.create",
  add_doc: "lyfe.library.doc.create",
  log_work: "lyfe.tracking.worklog.create",
  add_goal: "lyfe.tracking.goal.create",
  add_education: "lyfe.tracking.education.create",
  add_project: "lyfe.projects.create",
});
const ACCEPTANCE = Object.freeze({
  add_task: "One matching open task exists.",
  complete_task: "The single intended task is complete.",
  add_note: "One matching note exists.",
  add_doc: "One matching document exists.",
  log_work: "One matching work-log entry exists.",
  add_goal: "One matching active goal exists.",
  add_education: "One matching learning item exists.",
  add_project: "One matching active project exists.",
});
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ProtocolError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
    this.status = status;
  }
}

function text(value, max = 500) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

function clone(value) {
  return structuredClone(value);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonical(value[key]);
    return result;
  }, {});
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function digestValue(value) {
  const encoded = new TextEncoder().encode(JSON.stringify(canonical(value)));
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoded)));
}

export async function hashToken(value) {
  return digestValue(String(value || ""));
}

export function randomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function exact(left, right) {
  return text(left, 4_000).toLocaleLowerCase() === text(right, 4_000).toLocaleLowerCase();
}

function validDate(value) {
  const clean = text(value, 20);
  return DATE_RE.test(clean) ? clean : null;
}

function normalizeAction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProtocolError("ACTION_NOT_OBJECT", "Every action must be an object.");
  }
  const type = text(value.type, 60);
  if (!SUPPORTED_ACTIONS.includes(type)) {
    throw new ProtocolError("CAPABILITY_DENIED", `Aero cannot execute ${type || "this action"} on the signed-in route.`);
  }
  const unknown = Object.keys(value).filter((key) => !ACTION_FIELDS.includes(key));
  if (unknown.length) {
    throw new ProtocolError("ACTION_UNKNOWN_FIELD", `Unsupported action fields: ${unknown.join(", ")}.`);
  }
  const clean = { type };
  for (const key of ACTION_FIELDS) {
    if (key === "type" || key === "hours" || value[key] == null) continue;
    if (typeof value[key] !== "string") {
      throw new ProtocolError("ACTION_VALUE_TYPE", `${key} must be text.`);
    }
    const limit = ["body", "text"].includes(key) ? 2_000 : 240;
    if (value[key].length > limit) {
      throw new ProtocolError("ACTION_VALUE_TOO_LONG", `${key} exceeds the ${limit}-character execution limit.`);
    }
    clean[key] = text(value[key], limit);
  }
  if (value.hours != null) {
    if (typeof value.hours !== "number" || !Number.isFinite(value.hours) || value.hours < 0 || value.hours > 24) {
      throw new ProtocolError("ACTION_HOURS_RANGE", "Work hours must be a number from 0 to 24.");
    }
    clean.hours = value.hours;
  }
  for (const key of ["date", "due", "horizon"]) {
    if (clean[key] && !DATE_RE.test(clean[key])) {
      throw new ProtocolError("ACTION_DATE_FORMAT", `${key} must use YYYY-MM-DD.`);
    }
  }
  if (clean.area && !AREAS.includes(clean.area)) {
    throw new ProtocolError("ACTION_AREA", "The Lyfe area is unsupported.");
  }
  if (clean.priority && !PRIORITIES.includes(clean.priority)) {
    throw new ProtocolError("ACTION_PRIORITY", "The task priority is unsupported.");
  }
  if (clean.kind && !EDUCATION_KINDS.includes(clean.kind)) {
    throw new ProtocolError("ACTION_EDUCATION_KIND", "The learning type is unsupported.");
  }

  const has = (key) => !!text(clean[key], 2_100);
  let valid = true;
  if (["add_task", "complete_task", "add_goal", "add_education"].includes(type)) valid = has("title");
  else if (type === "add_project") valid = has("name") || has("title");
  else if (type === "add_note" || type === "add_doc") valid = has("title") || has("body");
  else if (type === "log_work") valid = has("text");
  if (!valid) throw new ProtocolError("ACTION_REQUIRED_VALUE", "The action is missing its target value.");
  return clean;
}

export function normalizeActions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    throw new ProtocolError("ACTION_COUNT", "A run needs between one and eight reversible Lyfe changes.");
  }
  return value.map(normalizeAction);
}

function normalizeState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProtocolError("STATE_INVALID", "The Lyfe state must be an object.", 409);
  }
  const state = clone(value);
  for (const collection of COLLECTIONS) {
    if (state[collection] == null) state[collection] = [];
    if (!Array.isArray(state[collection])) {
      throw new ProtocolError("STATE_INVALID", `${collection} must be a list.`, 409);
    }
    const ids = new Set();
    state[collection] = state[collection].map((record) => {
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw new ProtocolError("STATE_INVALID", `${collection} contains a non-record value.`, 409);
      }
      const id = text(record.id, 220);
      if (!id || ids.has(id)) {
        throw new ProtocolError("STATE_INVALID", `${collection} records need unique non-empty IDs.`, 409);
      }
      ids.add(id);
      return clone(record);
    });
  }
  return state;
}

function recordId(seed, index, collection) {
  const base = `aero-${seed}-${index + 1}`;
  const used = new Set(collection.map((item) => String(item.id || "")));
  let candidate = base;
  let suffix = 1;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

function reviewFor(actions) {
  return actions.map((action, index) => ({
    stepId: `step-${index + 1}`,
    type: action.type,
    subject: text(action.title || action.name || action.text || action.body || "item", 180),
    capability: CAPABILITIES[action.type],
    acceptance: ACCEPTANCE[action.type],
  }));
}

async function materialize(stateValue, actions, seed, atMs) {
  const target = normalizeState(stateValue);
  const patches = [];
  const today = new Date(atMs).toISOString().slice(0, 10);

  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    let collection = "";
    let record = null;
    let operation = "insert";
    let position = "end";
    if (action.type === "add_task") {
      collection = "tasks";
      record = {
        id: recordId(seed, index, target[collection]),
        title: action.title.slice(0, 200),
        area: action.area || "Personal",
        priority: action.priority || "Medium",
        due: validDate(action.due),
        projectId: null,
        notes: "",
        status: "open",
        createdAt: atMs,
        completedAt: null,
      };
      target[collection].push(record);
    } else if (action.type === "complete_task") {
      collection = "tasks";
      const query = action.title.toLocaleLowerCase();
      const matches = target.tasks.filter((task) => {
        const title = text(task.title, 4_000).toLocaleLowerCase();
        return task.status !== "done" && (title.includes(query) || query.includes(title));
      });
      if (matches.length !== 1) {
        throw new ProtocolError("TARGET_NOT_SINGULAR", "Completion requires exactly one matching open task.", 409);
      }
      const matchIndex = target.tasks.indexOf(matches[0]);
      record = { ...clone(matches[0]), status: "done", completedAt: atMs };
      target.tasks[matchIndex] = record;
      operation = "replace";
    } else if (action.type === "add_note" || action.type === "add_doc") {
      collection = action.type === "add_doc" ? "docs" : "notes";
      const body = text(action.body, 2_000);
      const title = text(action.title, 120) || body.slice(0, 48) || "Untitled";
      record = {
        id: recordId(seed, index, target[collection]),
        title,
        body,
        pinned: false,
        createdAt: atMs,
        updatedAt: atMs,
      };
      target[collection].unshift(record);
      position = "start";
    } else if (action.type === "log_work") {
      collection = "worklog";
      record = {
        id: recordId(seed, index, target[collection]),
        date: validDate(action.date) || today,
        text: action.text,
        hours: action.hours == null ? null : action.hours,
        createdAt: atMs,
      };
      target[collection].push(record);
    } else if (action.type === "add_goal") {
      collection = "goals";
      record = {
        id: recordId(seed, index, target[collection]),
        title: action.title.slice(0, 200),
        why: text(action.why, 240),
        horizon: validDate(action.horizon),
        status: "active",
        milestones: [],
        createdAt: atMs,
      };
      target[collection].push(record);
    } else if (action.type === "add_education") {
      collection = "education";
      record = {
        id: recordId(seed, index, target[collection]),
        title: action.title.slice(0, 200),
        provider: text(action.provider, 240),
        kind: action.kind || "Course",
        status: "in-progress",
        progress: 0,
        startDate: null,
        targetDate: null,
        notes: "",
        createdAt: atMs,
      };
      target[collection].push(record);
    } else if (action.type === "add_project") {
      collection = "projects";
      record = {
        id: recordId(seed, index, target[collection]),
        name: text(action.name || action.title, 160),
        area: action.area || "Work",
        status: "active",
        progress: 0,
        targetDate: null,
        description: text(action.description, 240),
        createdAt: atMs,
      };
      target[collection].push(record);
    }
    patches.push({
      stepId: `step-${index + 1}`,
      idempotencyKey: await digestValue({ seed, index, action }),
      op: operation,
      collection,
      position,
      record,
      capability: CAPABILITIES[action.type],
      acceptance: ACCEPTANCE[action.type],
    });
  }
  return { target, patches };
}

export async function prepareRunMaterial(input) {
  const userId = text(input && input.userId, 80);
  const requestKey = text(input && input.requestKey, 160);
  const runId = text(input && input.runId, 80);
  const intent = text(input && input.intent, 1_000);
  const baseRev = Number(input && input.rev);
  if (!UUID_RE.test(userId) || !UUID_RE.test(runId)) {
    throw new ProtocolError("RUN_IDENTITY", "The authenticated run identity is invalid.");
  }
  if (requestKey.length < 8 || requestKey.length > 160) {
    throw new ProtocolError("REQUEST_KEY", "The request key must contain 8 to 160 characters.");
  }
  if (!Number.isSafeInteger(baseRev) || baseRev < 0) {
    throw new ProtocolError("STATE_REVISION", "The Lyfe revision is invalid.", 409);
  }

  const actions = normalizeActions(input.actions);
  const state = normalizeState(input.state);
  const savedAt = Number(state.savedAt);
  if (!Number.isSafeInteger(savedAt) || savedAt < 1_600_000_000_000) {
    throw new ProtocolError("STATE_SAVED_AT", "Lyfe must finish its current sync before Aero can prepare a run.", 409);
  }
  // The logical execution timestamp is derived from the exact base document,
  // not the Edge Function clock. A retry therefore materializes byte-for-byte
  // identical records and receives the same target-bound contract.
  const atMs = savedAt + 1;
  const beforeDigest = await digestValue(state);
  const seed = (await digestValue({ userId, requestKey })).slice(0, 20);
  const materialized = await materialize(state, actions, seed, atMs);
  materialized.target.rev = baseRev + 1;
  materialized.target.savedAt = atMs;
  const targetDigest = await digestValue(materialized.target);
  const contract = {
    protocol: PROTOCOL_VERSION,
    requestKey,
    accountId: userId,
    intent,
    actions,
    state: { baseRev, beforeDigest },
    target: { nextRev: baseRev + 1, digest: targetDigest },
    capabilities: actions.map((action) => CAPABILITIES[action.type]),
    acceptance: actions.map((action) => ACCEPTANCE[action.type]),
    route: "supabase-atomic-state-engine",
    rollbackPolicy: "database-transaction",
    budget: { maxSteps: actions.length, maxWallMs: 15_000, maxExternalWrites: 1 },
  };
  const contractDigest = await digestValue(contract);
  return {
    runId,
    requestKey,
    protocol: PROTOCOL_VERSION,
    contract,
    contractDigest,
    baseRev,
    beforeDigest,
    targetData: materialized.target,
    targetDigest,
    patches: materialized.patches,
    review: reviewFor(actions),
  };
}

export function isUuid(value) {
  return UUID_RE.test(String(value || ""));
}

export function isDigest(value) {
  return /^[0-9a-f]{64}$/.test(String(value || ""));
}

export function recordsMatch(left, right) {
  return exact(left, right);
}
