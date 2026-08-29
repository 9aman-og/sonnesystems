/*
 * Pure, model-neutral protocol for Aero's server-owned typed memory.
 *
 * The Edge Function supplies an authenticated account and the current private
 * memory state. This module validates a closed operation schema, applies the
 * epistemic/adaptation policy deterministically, and binds an exact target for
 * one atomic Postgres commit. It has no network or provider dependency.
 */

export const PROTOCOL_VERSION = "aero-memory-v0.3";
export const MEMORY_TYPES = Object.freeze(["episodic", "semantic", "project", "procedural"]);
export const MEMORY_STATUSES = Object.freeze([
  "candidate", "provisional", "active", "disputed", "superseded", "invalidated",
]);
export const OPERATION_TYPES = Object.freeze(["remember", "forget", "reset", "observe"]);

const MAX_MEMORIES = 300;
const MAX_TRANSACTIONS = 120;
const MAX_EPISODES = 500;
const DAY_MS = 24 * 60 * 60 * 1_000;
const USABLE = new Set(["active", "provisional"]);
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

function list(value) { return Array.isArray(value) ? value : []; }

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
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

export function hashToken(value) { return digestValue(String(value || "")); }

export function randomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fingerprint(value) {
  const input = JSON.stringify(canonical(value));
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableId(prefix, seed, used = new Set()) {
  let value = `${prefix}_${seed}`;
  let suffix = 1;
  while (used.has(value)) {
    suffix += 1;
    value = `${prefix}_${seed}_${suffix}`;
  }
  return value;
}

function normalizeSourceRef(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = {
    kind: text(value.kind, 60), id: text(value.id, 120),
    label: text(value.label, 160), at: Math.max(0, Number(value.at || 0)),
    authority: ["user", "behavior", "workspace", "external"].includes(value.authority)
      ? value.authority : "external",
  };
  return source.kind && source.id ? source : null;
}

function memoryKeyFor(candidate, claim) {
  const explicit = text(candidate.memoryKey || candidate.patternKey, 240).toLowerCase();
  if (explicit) return explicit;
  const type = MEMORY_TYPES.includes(candidate.type) ? candidate.type : "semantic";
  const scope = text(candidate.scope, 100).toLowerCase() || "global";
  const normalized = text(claim, 800).toLowerCase();
  const slot = normalized.match(/^(?:my|the)\s+([\p{L}\p{N}][\p{L}\p{N}\s_-]{0,70}?)\s+(?:is|are|=)\s+.+$/u);
  if (slot) return `${type}|${scope}|slot:${slot[1].replace(/\s+/g, " ").trim()}`;
  return `${type}|${scope}|claim:${normalized}`;
}

function normalizeMemory(value, now = Date.now()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const claim = text(value.claim, 800);
  if (!claim) return null;
  const createdAt = Math.max(1, Number(value.createdAt || now));
  const sourceMode = value.sourceMode === "inferred" ? "inferred" : "explicit";
  return {
    id: text(value.id, 120),
    type: MEMORY_TYPES.includes(value.type) ? value.type : "semantic",
    scope: text(value.scope, 100) || "global",
    claim,
    memoryKey: text(value.memoryKey, 240).toLowerCase() || memoryKeyFor(value, claim),
    sourceMode,
    authority: ["user", "behavior"].includes(value.authority)
      ? value.authority : (sourceMode === "explicit" ? "user" : "behavior"),
    status: MEMORY_STATUSES.includes(value.status)
      ? value.status : (sourceMode === "explicit" ? "active" : "candidate"),
    confidence: Math.max(0, Math.min(1, Number(value.confidence == null ? (sourceMode === "explicit" ? 1 : 0.45) : value.confidence))),
    evidence: list(value.evidence).map((item) => text(item, 160)).filter(Boolean).slice(-12),
    sourceRefs: list(value.sourceRefs).map(normalizeSourceRef).filter(Boolean).slice(-16),
    patternKey: text(value.patternKey, 240),
    dependsOn: list(value.dependsOn).map((item) => text(item, 120)).filter(Boolean).slice(-24),
    supersedes: list(value.supersedes).map((item) => text(item, 120)).filter(Boolean).slice(-12),
    supersededBy: text(value.supersededBy, 120),
    invalidatedBy: list(value.invalidatedBy).map((item) => text(item, 120)).filter(Boolean).slice(-12),
    revision: Math.max(0, Number(value.revision || 0)),
    commitId: text(value.commitId, 120),
    validFrom: Math.max(1, Number(value.validFrom || createdAt)),
    validUntil: Math.max(0, Number(value.validUntil || 0)),
    successCount: Math.max(0, Number(value.successCount || 0)),
    failureCount: Math.max(0, Number(value.failureCount || 0)),
    distinctDays: list(value.distinctDays).map((item) => text(item, 10)).filter(Boolean).slice(-30),
    lastUsed: Math.max(0, Number(value.lastUsed || 0)),
    lastConfirmed: Math.max(0, Number(value.lastConfirmed || 0)),
    contradictions: list(value.contradictions).map((item) => text(item, 160)).filter(Boolean).slice(-12),
    episodeOutcomes: list(value.episodeOutcomes).filter((item) => item && typeof item === "object")
      .slice(-50).map((item) => ({
        id: text(item.id, 120),
        polarity: item.polarity === "negative" ? "negative" : "positive",
        outcome: text(item.outcome, 30),
      })).filter((item) => item.id),
    wasPromoted: value.wasPromoted === true,
    createdAt,
    updatedAt: Math.max(createdAt, Number(value.updatedAt || createdAt)),
  };
}

function normalizeJournalImage(value, now) {
  if (!value || typeof value !== "object") return null;
  if (value.redacted === true) return { id: text(value.id, 120), redacted: true };
  return normalizeMemory(value, now);
}

function transactionPayload(transaction) {
  return {
    id: transaction.id, revision: transaction.revision, kind: transaction.kind,
    status: transaction.status, reason: transaction.reason,
    sourceRefs: transaction.sourceRefs, changes: transaction.changes,
    reverts: transaction.reverts, previousFingerprint: transaction.previousFingerprint,
    reversible: transaction.reversible, createdAt: transaction.createdAt,
  };
}

function normalizeTransaction(value, now) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    id: text(value.id, 120),
    revision: Math.max(0, Number(value.revision || 0)),
    kind: text(value.kind, 60) || "update",
    status: ["committed", "reverted", "recovery-blocked"].includes(value.status) ? value.status : "committed",
    reason: text(value.reason, 260),
    sourceRefs: list(value.sourceRefs).map(normalizeSourceRef).filter(Boolean).slice(-16),
    changes: list(value.changes).slice(0, 80).map((change) => ({
      memoryId: text(change && change.memoryId, 120),
      before: normalizeJournalImage(change && change.before, now),
      after: normalizeJournalImage(change && change.after, now),
    })).filter((change) => change.memoryId),
    reverts: text(value.reverts, 120),
    previousFingerprint: text(value.previousFingerprint, 80),
    reversible: value.reversible !== false,
    createdAt: Math.max(1, Number(value.createdAt || now)),
    fingerprint: text(value.fingerprint, 80),
  };
}

function normalizeEpisode(value, now) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const signal = text(value.signal, 2_000);
  if (!signal) return null;
  const outcome = ["pending", "helpful", "missed", "accepted", "rejected", "undone", "answered"].includes(value.outcome)
    ? value.outcome : "pending";
  return {
    id: text(value.id, 120),
    signal,
    surface: text(value.surface, 50) || "aero",
    family: text(value.family, 60) || classifyIntent(signal),
    wordCount: Math.max(1, Math.min(2_000, Number(value.wordCount || wordCount(signal)))),
    coldBaseline: Math.max(1, Math.min(2_000, Number(value.coldBaseline || value.wordCount || wordCount(signal)))),
    contextId: text(value.contextId, 120),
    outcome,
    firstPass: value.firstPass === true || outcome === "helpful" || outcome === "accepted",
    actionTypes: list(value.actionTypes).map((item) => text(item, 60)).filter(Boolean).sort().slice(0, 8),
    createdAt: Math.max(1, Number(value.createdAt || now)),
    completedAt: Math.max(0, Number(value.completedAt || 0)),
  };
}

export function freshState(now = Date.now()) {
  return {
    version: 3,
    memories: [],
    memoryRevision: 0,
    memoryJournal: [],
    episodes: [],
    lastContext: null,
    createdAt: now,
    lastServerAt: now,
  };
}

export function normalizeState(value, now = Date.now()) {
  const state = freshState(now);
  if (!value || typeof value !== "object" || Array.isArray(value)) return state;
  const ids = new Set();
  state.memories = list(value.memories).map((item) => normalizeMemory(item, now)).filter(Boolean)
    .map((memory, index) => {
      if (!memory.id || ids.has(memory.id)) memory.id = stableId("mem", `legacy-${index + 1}`, ids);
      ids.add(memory.id);
      return memory;
    }).slice(-MAX_MEMORIES);
  state.memoryRevision = Math.max(0, Number(value.memoryRevision || 0));
  state.memoryJournal = list(value.memoryJournal).map((item) => normalizeTransaction(item, now)).filter(Boolean).slice(-MAX_TRANSACTIONS);
  state.episodes = list(value.episodes).map((item) => normalizeEpisode(item, now)).filter(Boolean).slice(-MAX_EPISODES);
  state.lastContext = value.lastContext && typeof value.lastContext === "object" ? clone(value.lastContext) : null;
  state.createdAt = Math.max(1, Number(value.createdAt || now));
  state.lastServerAt = Math.max(state.createdAt, Number(value.lastServerAt || state.createdAt));
  return state;
}

function mergeUnique(left, right, limit = 16) {
  const result = [];
  for (const value of list(left).concat(list(right))) {
    const key = typeof value === "object" ? JSON.stringify(canonical(value)) : String(value);
    if (!result.some((item) => (typeof item === "object" ? JSON.stringify(canonical(item)) : String(item)) === key)) result.push(value);
  }
  return result.slice(-limit);
}

function rememberBefore(before, memory) {
  if (!memory || Object.prototype.hasOwnProperty.call(before, memory.id)) return;
  before[memory.id] = clone(memory);
}

function dependencyProblems(state, memoryId, dependsOn) {
  const byId = new Map(state.memories.map((memory) => [memory.id, memory]));
  const problems = [];
  function reachesTarget(startId, seen) {
    if (startId === memoryId) return true;
    if (seen.has(startId)) return false;
    seen.add(startId);
    const current = byId.get(startId);
    return !!current && current.dependsOn.some((dependencyId) => reachesTarget(dependencyId, seen));
  }
  for (const dependencyId of list(dependsOn)) {
    const dependency = byId.get(dependencyId);
    if (!dependency || !USABLE.has(dependency.status) || reachesTarget(dependencyId, new Set())) problems.push(dependencyId);
  }
  return [...new Set(problems)];
}

function invalidateDependents(state, rootIds, before, reason, now) {
  const queue = [...list(rootIds)];
  const invalidated = [];
  while (queue.length) {
    const rootId = queue.shift();
    for (const memory of state.memories) {
      if (["superseded", "invalidated"].includes(memory.status)) continue;
      if (!memory.dependsOn.includes(rootId) || invalidated.includes(memory.id)) continue;
      rememberBefore(before, memory);
      memory.status = "invalidated";
      memory.validUntil = now;
      memory.invalidatedBy = mergeUnique(memory.invalidatedBy, [rootId], 12);
      memory.contradictions = mergeUnique(memory.contradictions, [text(reason, 160) || "A dependency changed."], 12);
      memory.updatedAt = now;
      invalidated.push(memory.id);
      queue.push(memory.id);
    }
  }
  return invalidated;
}

function scrubForgottenFromJournal(state, memoryIds) {
  const forgotten = new Set(memoryIds);
  for (const transaction of state.memoryJournal) {
    let changed = false;
    for (const change of transaction.changes) {
      if (!forgotten.has(change.memoryId)) continue;
      change.before = { id: change.memoryId, redacted: true };
      change.after = change.after ? { id: change.memoryId, redacted: true } : null;
      transaction.reversible = false;
      changed = true;
    }
    if (changed) transaction.fingerprint = fingerprint(transactionPayload(transaction));
  }
  rechainJournal(state);
}

function rechainJournal(state) {
  state.memoryJournal.forEach((transaction, index) => {
    transaction.previousFingerprint = index ? state.memoryJournal[index - 1].fingerprint : "";
    transaction.fingerprint = fingerprint(transactionPayload(transaction));
  });
}

export function verifyJournal(value) {
  const state = normalizeState(value);
  const invalid = [];
  state.memoryJournal.forEach((transaction, index) => {
    const previous = index ? state.memoryJournal[index - 1] : null;
    if (!transaction.fingerprint || transaction.fingerprint !== fingerprint(transactionPayload(transaction))) invalid.push(transaction.id);
    if (previous && (transaction.revision <= previous.revision || transaction.previousFingerprint !== previous.fingerprint)) invalid.push(transaction.id);
  });
  if (state.memoryJournal.length && state.memoryJournal.at(-1).revision !== state.memoryRevision) invalid.push("journal-head");
  return { valid: invalid.length === 0, invalidTransactionIds: [...new Set(invalid)], transactions: state.memoryJournal.length };
}

function normalizeRemember(value) {
  const allowed = new Set(["type", "claim", "memoryType", "scope", "memoryKey", "dependsOn", "supersedes"]);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new ProtocolError("MEMORY_UNKNOWN_FIELD", `Unsupported memory fields: ${unknown.join(", ")}.`);
  const claim = text(value.claim, 800);
  if (!claim) throw new ProtocolError("MEMORY_CLAIM", "A memory needs a claim.");
  if (String(value.claim || "").length > 800) throw new ProtocolError("MEMORY_CLAIM", "A memory claim cannot exceed 800 characters.");
  const memoryType = text(value.memoryType, 30) || "semantic";
  if (!MEMORY_TYPES.includes(memoryType)) throw new ProtocolError("MEMORY_TYPE", "The memory type is unsupported.");
  const dependsOn = list(value.dependsOn).map((item) => text(item, 120)).filter(Boolean).slice(0, 24);
  const supersedes = list(value.supersedes).map((item) => text(item, 120)).filter(Boolean).slice(0, 12);
  return {
    type: "remember", claim, memoryType,
    scope: text(value.scope, 100) || "global",
    memoryKey: text(value.memoryKey, 240).toLowerCase(),
    dependsOn, supersedes,
  };
}

function normalizeForget(value) {
  const allowed = new Set(["type", "query"]);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new ProtocolError("MEMORY_UNKNOWN_FIELD", `Unsupported forget fields: ${unknown.join(", ")}.`);
  const query = text(value.query, 800);
  if (!query) throw new ProtocolError("MEMORY_QUERY", "Choose the exact memory to forget.");
  return { type: "forget", query };
}

function normalizeReset(value) {
  const unknown = Object.keys(value).filter((key) => key !== "type");
  if (unknown.length) throw new ProtocolError("MEMORY_UNKNOWN_FIELD", `Unsupported reset fields: ${unknown.join(", ")}.`);
  return { type: "reset" };
}

function normalizeObserve(value, now) {
  const allowed = new Set(["type", "episode", "outcome"]);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new ProtocolError("MEMORY_UNKNOWN_FIELD", `Unsupported outcome fields: ${unknown.join(", ")}.`);
  const episode = normalizeEpisode(value.episode, now);
  if (!episode || !episode.id) throw new ProtocolError("EPISODE_INVALID", "Outcome evidence needs a stable episode.");
  const outcome = text(value.outcome, 30);
  if (!["helpful", "missed", "accepted", "rejected", "undone"].includes(outcome)) {
    throw new ProtocolError("OUTCOME_INVALID", "The outcome is unsupported.");
  }
  // The separately supplied outcome is the authority. A browser cache may
  // already display that outcome, but it cannot pre-answer the server ledger.
  episode.outcome = "pending";
  episode.firstPass = false;
  episode.completedAt = 0;
  return { type: "observe", episode, outcome };
}

export function normalizeOperations(value, now = Date.now()) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    throw new ProtocolError("MEMORY_OPERATION_COUNT", "A memory transaction needs one to eight operations.");
  }
  return value.map((operation) => {
    if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
      throw new ProtocolError("MEMORY_OPERATION", "Every memory operation must be an object.");
    }
    const type = text(operation.type, 30);
    if (!OPERATION_TYPES.includes(type)) throw new ProtocolError("MEMORY_CAPABILITY_DENIED", "That memory operation is not available.");
    if (type === "remember") return normalizeRemember(operation);
    if (type === "forget") return normalizeForget(operation);
    if (type === "reset") return normalizeReset(operation);
    return normalizeObserve(operation, now);
  });
}

function applyRemember(state, operation, context) {
  const { before, affected, sourceRefs, now, seed, operationIndex } = context;
  const claim = operation.claim;
  const memoryKey = memoryKeyFor({ type: operation.memoryType, scope: operation.scope, memoryKey: operation.memoryKey }, claim);
  const existing = state.memories.find((memory) => memory.memoryKey === memoryKey
    && memory.claim.toLowerCase() === claim.toLowerCase()
    && !["superseded", "invalidated"].includes(memory.status));
  if (existing) {
    rememberBefore(before, existing);
    affected.add(existing.id);
    existing.sourceMode = "explicit";
    existing.authority = "user";
    existing.status = "active";
    existing.confidence = 1;
    existing.validUntil = 0;
    existing.lastConfirmed = now;
    existing.updatedAt = now;
    existing.sourceRefs = mergeUnique(existing.sourceRefs, sourceRefs, 16);
    existing.evidence = mergeUnique(existing.evidence, ["Confirmed directly in Aero"], 12);
    existing.dependsOn = [...operation.dependsOn];
    existing.invalidatedBy = [];
    const problems = dependencyProblems(state, existing.id, existing.dependsOn);
    if (problems.length) {
      existing.status = "invalidated";
      existing.validUntil = now;
      existing.invalidatedBy = problems;
      existing.contradictions = mergeUnique(existing.contradictions, ["A declared dependency is missing, stale, or cyclic."], 12);
      invalidateDependents(state, [existing.id], before, "A source memory gained an invalid dependency.", now).forEach((id) => affected.add(id));
      return;
    }
    const conflicts = state.memories.filter((memory) => memory.id !== existing.id
      && memory.memoryKey === memoryKey && memory.claim.toLowerCase() !== claim.toLowerCase()
      && ["active", "provisional", "candidate", "disputed"].includes(memory.status));
    for (const memory of conflicts) {
      rememberBefore(before, memory);
      affected.add(memory.id);
      memory.status = "superseded";
      memory.supersededBy = existing.id;
      memory.validUntil = now;
      memory.updatedAt = now;
      existing.supersedes = mergeUnique(existing.supersedes, [memory.id], 12);
    }
    invalidateDependents(state, conflicts.map((memory) => memory.id), before, "A direct user confirmation resolved a conflicting memory.", now)
      .forEach((id) => affected.add(id));
    return;
  }

  const used = new Set(state.memories.map((memory) => memory.id));
  const id = stableId("mem", `${seed}-${operationIndex + 1}`, used);
  const memory = normalizeMemory({
    id, type: operation.memoryType, scope: operation.scope, claim, memoryKey,
    sourceMode: "explicit", authority: "user", status: "active", confidence: 1,
    evidence: ["Taught directly in Aero"], sourceRefs,
    dependsOn: operation.dependsOn, supersedes: operation.supersedes,
    createdAt: now, updatedAt: now, validFrom: now, lastConfirmed: now,
  }, now);
  before[id] = null;
  affected.add(id);
  const problems = dependencyProblems(state, id, memory.dependsOn);
  if (problems.length) {
    memory.status = "invalidated";
    memory.validUntil = now;
    memory.invalidatedBy = problems;
    memory.contradictions = ["A declared dependency is missing, stale, or cyclic."];
  }
  const incumbents = state.memories.filter((item) => item.memoryKey === memoryKey
    && ["active", "provisional", "candidate", "disputed"].includes(item.status));
  for (const incumbent of incumbents) {
    rememberBefore(before, incumbent);
    affected.add(incumbent.id);
    incumbent.status = "superseded";
    incumbent.supersededBy = id;
    incumbent.validUntil = now;
    incumbent.updatedAt = now;
    memory.supersedes = mergeUnique(memory.supersedes, [incumbent.id], 12);
  }
  invalidateDependents(state, incumbents.map((memory) => memory.id), before, "A source memory was superseded.", now)
    .forEach((memoryId) => affected.add(memoryId));
  state.memories.push(memory);
}

function applyForget(state, operation, context) {
  const { before, affected, forgotten, now } = context;
  const query = operation.query.toLowerCase();
  const exactId = state.memories.find((memory) => memory.id.toLowerCase() === query);
  const matches = exactId ? [exactId] : state.memories.filter((memory) => memory.claim.toLowerCase().includes(query));
  if (matches.length !== 1) throw new ProtocolError("MEMORY_NOT_SINGULAR", "Forgetting requires exactly one matching memory.", 409);
  const ids = matches.map((memory) => memory.id);
  matches.forEach((memory) => { rememberBefore(before, memory); affected.add(memory.id); forgotten.add(memory.id); });
  invalidateDependents(state, ids, before, "A dependency was forgotten by the user.", now).forEach((id) => affected.add(id));
  scrubForgottenFromJournal(state, ids);
  state.memories = state.memories.filter((memory) => !forgotten.has(memory.id));
}

function applyReset(state, context) {
  const { before, affected, forgotten } = context;
  for (const memory of state.memories) {
    before[memory.id] = { id: memory.id, redacted: true };
    affected.add(memory.id);
    forgotten.add(memory.id);
  }
  state.memories = [];
  state.episodes = [];
  state.memoryJournal = [];
  state.lastContext = null;
  return true;
}

function classifyIntent(signal) {
  const value = text(signal, 2_000).toLowerCase();
  if (/\b(due|today|next|priority|matters)\b/.test(value)) return "triage";
  if (/\b(compare|research|paper|document|note|library)\b/.test(value)) return "research";
  if (/\b(follow up|reply|email|message|gmail|connect)\b/.test(value)) return "follow-up";
  if (/\b(remind|task|todo|goal|project|log|worked)\b/.test(value)) return "organize";
  if (/\b(remember|forget|prefer|usually|same as last time)\b/.test(value)) return "memory";
  return "general";
}

function wordCount(signal) {
  const words = text(signal, 2_000).match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return words ? words.length : 1;
}

function applyObserve(state, operation, context) {
  const { before, affected, sourceRefs, now, seed, operationIndex } = context;
  let episode = state.episodes.find((item) => item.id === operation.episode.id);
  if (!episode) {
    episode = clone(operation.episode);
    state.episodes.push(episode);
    state.episodes = state.episodes.slice(-MAX_EPISODES);
  }
  const priorOutcome = episode.outcome;
  episode.outcome = operation.outcome;
  episode.firstPass = ["helpful", "accepted"].includes(operation.outcome);
  episode.completedAt = now;
  if (priorOutcome === operation.outcome) return false;
  if (episode.wordCount > 8 || !episode.signal) return true;
  const positive = episode.firstPass;
  const negative = ["missed", "rejected", "undone"].includes(operation.outcome);
  if (!positive && !negative) return true;
  const target = episode.actionTypes.length ? episode.actionTypes.join(" + ") : episode.family;
  const signalKey = episode.signal.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, "").replace(/\s+/g, " ").trim();
  const patternKey = `${episode.surface}|${signalKey}|${target}`;
  let memory = state.memories.find((item) => item.patternKey === patternKey);
  if (!memory && !positive) return true;
  if (!memory) {
    const used = new Set(state.memories.map((item) => item.id));
    const id = stableId("mem", `${seed}-${operationIndex + 1}`, used);
    memory = normalizeMemory({
      id, type: "procedural", scope: episode.surface,
      claim: `On ${episode.surface}, shorthand ‘${text(episode.signal, 120)}’ has meant ${target}.`,
      memoryKey: patternKey, patternKey, sourceMode: "inferred", authority: "behavior",
      status: "candidate", confidence: 0.45, sourceRefs,
      createdAt: now, updatedAt: now, validFrom: now,
    }, now);
    before[id] = null;
    affected.add(id);
    state.memories.push(memory);
  } else {
    rememberBefore(before, memory);
    affected.add(memory.id);
  }
  const polarity = positive ? "positive" : "negative";
  const prior = memory.episodeOutcomes.find((item) => item.id === episode.id);
  if (prior && prior.polarity === polarity) return true;
  if (prior) {
    if (prior.polarity === "positive") memory.successCount = Math.max(0, memory.successCount - 1);
    else memory.failureCount = Math.max(0, memory.failureCount - 1);
    prior.polarity = polarity;
    prior.outcome = operation.outcome;
  } else {
    memory.episodeOutcomes.push({ id: episode.id, polarity, outcome: operation.outcome });
  }
  memory.updatedAt = now;
  memory.lastUsed = now;
  const day = new Date(now).toISOString().slice(0, 10);
  if (positive) {
    memory.successCount += 1;
    memory.lastConfirmed = now;
    if (!memory.distinctDays.includes(day)) memory.distinctDays.push(day);
    memory.evidence = mergeUnique(memory.evidence, [`${operation.outcome} · ${day}`], 12);
    memory.confidence = Math.min(0.88, 0.45 + memory.successCount * 0.11 + Math.min(0.1, memory.distinctDays.length * 0.03));
    if (memory.successCount >= 3 && memory.distinctDays.length >= 2 && memory.failureCount === 0) {
      memory.status = "provisional";
      memory.wasPromoted = true;
    } else if (!["provisional", "active"].includes(memory.status)) memory.status = "candidate";
  } else {
    memory.failureCount += 1;
    memory.contradictions = mergeUnique(memory.contradictions, [`${operation.outcome} · ${day}`], 12);
    memory.confidence = Math.max(0.1, memory.confidence - 0.2);
    if (memory.failureCount >= 2 || memory.failureCount >= memory.successCount) {
      memory.status = "disputed";
      invalidateDependents(state, [memory.id], before, "A learned procedure became disputed.", now).forEach((id) => affected.add(id));
    }
  }
  memory.distinctDays = memory.distinctDays.slice(-30);
  memory.episodeOutcomes = memory.episodeOutcomes.slice(-50);
  return true;
}

function reviewFor(operations) {
  return operations.map((operation, index) => {
    if (operation.type === "remember") return {
      stepId: `step-${index + 1}`, type: "memory_upsert", subject: operation.claim,
      capability: "aero.memory.explicit.write", authority: "user-explicit",
      acceptance: "One source-supported active memory exists; competing revisions are retired.",
    };
    if (operation.type === "forget") return {
      stepId: `step-${index + 1}`, type: "memory_forget", subject: operation.query,
      capability: "aero.memory.privacy.delete", authority: "user-explicit",
      acceptance: "The exact memory and its historical snapshots are no longer retained.",
    };
    if (operation.type === "reset") return {
      stepId: `step-${index + 1}`, type: "memory_reset", subject: "All Aero memories and adaptation history",
      capability: "aero.memory.privacy.reset", authority: "user-explicit",
      acceptance: "No prior memory claim, episode, or historical snapshot remains retained.",
    };
    return {
      stepId: `step-${index + 1}`, type: "memory_observe", subject: operation.episode.family,
      capability: "aero.memory.behavior.observe", authority: "behavior-only",
      acceptance: "Outcome evidence may update a candidate pattern but cannot become an explicit fact.",
    };
  });
}

function validateTargetState(state) {
  if (state.memories.length > MAX_MEMORIES || state.memoryJournal.length > MAX_TRANSACTIONS || state.episodes.length > MAX_EPISODES) {
    throw new ProtocolError("MEMORY_LIMIT", "The private memory budget was exceeded.", 409);
  }
  const byId = new Map(state.memories.map((memory) => [memory.id, memory]));
  if (byId.size !== state.memories.length) throw new ProtocolError("MEMORY_ID_CONFLICT", "Memory IDs must be unique.", 409);
  const liveKeys = new Set();
  for (const memory of state.memories) {
    if (USABLE.has(memory.status)) {
      if (liveKeys.has(memory.memoryKey)) throw new ProtocolError("MEMORY_LIVE_CONFLICT", "Only one usable revision may occupy a memory slot.", 409);
      liveKeys.add(memory.memoryKey);
      for (const dependencyId of memory.dependsOn) {
        const dependency = byId.get(dependencyId);
        if (!dependency || !USABLE.has(dependency.status)) throw new ProtocolError("MEMORY_STALE_DEPENDENCY", "Usable memory cannot depend on stale state.", 409);
      }
    }
  }
  if (!verifyJournal(state).valid) throw new ProtocolError("MEMORY_JOURNAL_INVALID", "The memory journal failed integrity verification.", 409);
}

export async function prepareMemoryMaterial(input) {
  const userId = text(input && input.userId, 80);
  const requestKey = text(input && input.requestKey, 160);
  const baseRevision = Number(input && input.revision);
  if (!UUID_RE.test(userId)) throw new ProtocolError("MEMORY_IDENTITY", "The authenticated account is invalid.");
  if (requestKey.length < 8 || requestKey.length > 160) throw new ProtocolError("MEMORY_REQUEST_KEY", "The request key must contain 8 to 160 characters.");
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) throw new ProtocolError("MEMORY_REVISION", "The memory revision is invalid.", 409);
  const state = normalizeState(input && input.state);
  if (state.memoryRevision !== baseRevision) throw new ProtocolError("MEMORY_REVISION", "The memory cache is stale.", 409);
  // Use a server-owned day anchor so retries against the same state are
  // deterministic, while evidence collected on different days is actually
  // distinguishable by the adaptation governor. Never trust a browser clock
  // for promotion evidence.
  const suppliedAuthorityNow = Number(input && input.authorityNow);
  const currentDayAnchor = Math.floor(Date.now() / DAY_MS) * DAY_MS + DAY_MS / 2;
  const authorityNow = Number.isSafeInteger(suppliedAuthorityNow) && suppliedAuthorityNow > 0
    ? suppliedAuthorityNow : currentDayAnchor;
  const now = Math.max(state.lastServerAt + 1, state.createdAt + 1, authorityNow);
  const operations = normalizeOperations(input && input.operations, now);
  const suppliedDigest = text(input && input.stateDigest, 80);
  const beforeDigest = isDigest(suppliedDigest) ? suppliedDigest : await digestValue(state);
  const seed = (await digestValue({ userId, requestKey })).slice(0, 20);
  const target = clone(state);
  const before = {};
  const affected = new Set();
  const forgotten = new Set();
  let observedChange = false;
  let resetApplied = false;
  const sourceRefs = [];

  operations.forEach((operation, operationIndex) => {
    const refs = operation.type === "observe"
      ? [{ kind: "behavioral-outcome", id: operation.episode.id, label: "Observed Aero outcome", at: now, authority: "behavior" }]
      : [{ kind: "user-explicit", id: `approved-${seed}`, label: "Approved directly in Aero", at: now, authority: "user" }];
    sourceRefs.push(...refs);
    const context = { before, affected, forgotten, sourceRefs: refs, now, seed, operationIndex };
    if (operation.type === "remember") applyRemember(target, operation, context);
    else if (operation.type === "forget") applyForget(target, operation, context);
    else if (operation.type === "reset") resetApplied = applyReset(target, context) || resetApplied;
    else observedChange = applyObserve(target, operation, context) || observedChange;
  });

  const meaningful = affected.size > 0 || observedChange || resetApplied;
  if (meaningful) {
    const revision = baseRevision + 1;
    const journalId = `mtx_${seed}`;
    const changes = [...affected].map((memoryId) => {
      const current = target.memories.find((memory) => memory.id === memoryId);
      if (current) { current.revision = revision; current.commitId = journalId; }
      const isForgotten = forgotten.has(memoryId);
      return {
        memoryId,
        before: isForgotten ? { id: memoryId, redacted: true }
          : (Object.prototype.hasOwnProperty.call(before, memoryId) ? clone(before[memoryId]) : null),
        after: current ? clone(current) : null,
      };
    });
    const kind = operations.every((operation) => operation.type === "observe") ? "outcome"
      : operations.some((operation) => ["forget", "reset"].includes(operation.type)) ? "forget"
        : "explicit";
    const transaction = {
      id: journalId, revision, kind, status: "committed",
      reason: kind === "outcome" ? "Outcome evidence updated a bounded candidate pattern"
        : kind === "forget" ? "User-requested privacy deletion"
          : "User-approved typed memory transaction",
      sourceRefs: sourceRefs.slice(-16), changes, reverts: "",
      previousFingerprint: target.memoryJournal.length ? target.memoryJournal.at(-1).fingerprint : "",
      reversible: forgotten.size === 0, createdAt: now, fingerprint: "",
    };
    transaction.fingerprint = fingerprint(transactionPayload(transaction));
    target.memoryRevision = revision;
    target.memoryJournal.push(transaction);
    target.memoryJournal = target.memoryJournal.slice(-MAX_TRANSACTIONS);
    target.memories = target.memories.slice(-MAX_MEMORIES);
    target.lastServerAt = now;
  }
  validateTargetState(target);
  const targetDigest = await digestValue(target);
  const operationDigest = await digestValue(operations);
  const review = reviewFor(operations);
  const contract = {
    protocol: PROTOCOL_VERSION,
    accountId: userId,
    requestKey,
    operations,
    state: { baseRevision, beforeDigest },
    target: { nextRevision: meaningful ? baseRevision + 1 : baseRevision, digest: targetDigest },
    capabilities: review.map((item) => item.capability),
    authority: operations.every((operation) => operation.type === "observe") ? "behavior-only" : "user-explicit",
    route: "supabase-private-memory-engine",
    rollbackPolicy: "database-transaction",
    budget: { maxOperations: operations.length, maxMemories: MAX_MEMORIES, maxExternalWrites: 1 },
  };
  return {
    protocol: PROTOCOL_VERSION,
    requestKey,
    operations,
    operationDigest,
    contract,
    contractDigest: await digestValue(contract),
    baseRevision,
    beforeDigest,
    targetState: target,
    targetDigest,
    review,
    noChange: !meaningful,
  };
}

export function memoryMetrics(value) {
  const state = normalizeState(value);
  const scored = state.episodes.filter((episode) => ["helpful", "missed", "accepted", "rejected", "undone"].includes(episode.outcome));
  const groups = new Map();
  scored.slice().sort((left, right) => left.createdAt - right.createdAt).forEach((episode) => {
    const key = episode.actionTypes.length ? `action:${episode.actionTypes.join("+")}` : `family:${episode.family}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(episode);
  });
  const pairs = [];
  for (const [key, episodes] of groups) {
    if (episodes.length < 2) continue;
    const baseline = episodes[0];
    for (const episode of episodes.slice(1)) {
      pairs.push({
        key,
        baselineWords: baseline.wordCount,
        currentWords: episode.wordCount,
        baselineFirstPass: baseline.firstPass,
        currentFirstPass: episode.firstPass,
      });
    }
  }
  const average = (items, field) => items.length ? items.reduce((sum, item) => sum + Number(item[field] || 0), 0) / items.length : 0;
  const rate = (items, field = "firstPass") => items.length ? items.filter((item) => item[field] === true).length / items.length : null;
  const baselineWords = average(pairs, "baselineWords");
  const currentWords = average(pairs, "currentWords");
  const baselineFirstPassRate = rate(pairs, "baselineFirstPass");
  const repeatFirstPassRate = rate(pairs, "currentFirstPass");
  const intentAccuracyDelta = baselineFirstPassRate == null || repeatFirstPassRate == null ? null : repeatFirstPassRate - baselineFirstPassRate;
  const compression = baselineWords > 0 ? 1 - currentWords / baselineWords : null;
  const inferred = state.memories.filter((memory) => memory.sourceMode === "inferred");
  const promoted = inferred.filter((memory) => memory.wasPromoted);
  const falsePromotions = promoted.filter((memory) => memory.failureCount > 0);
  return {
    episodes: state.episodes.length,
    scored: scored.length,
    firstPassRate: rate(scored),
    pairedSamples: pairs.length,
    compressionSamples: pairs.length,
    baselineWords,
    currentWords,
    compression,
    baselineFirstPassRate,
    repeatFirstPassRate,
    intentAccuracyDelta,
    memories: state.memories.length,
    activeMemories: state.memories.filter((memory) => USABLE.has(memory.status)).length,
    candidateMemories: state.memories.filter((memory) => memory.status === "candidate").length,
    disputedMemories: state.memories.filter((memory) => memory.status === "disputed").length,
    supersededMemories: state.memories.filter((memory) => memory.status === "superseded").length,
    invalidatedMemories: state.memories.filter((memory) => memory.status === "invalidated").length,
    memoryRevision: state.memoryRevision,
    memoryTransactions: state.memoryJournal.length,
    memoryJournalValid: verifyJournal(state).valid,
    promotionCount: promoted.length,
    falsePromotions: falsePromotions.length,
    falsePromotionRate: promoted.length ? falsePromotions.length / promoted.length : null,
    proofReady: pairs.length >= 5 && scored.length >= 10 && compression != null && compression > 0
      && intentAccuracyDelta != null && intentAccuracyDelta >= -0.02
      && (!promoted.length || falsePromotions.length / promoted.length <= 0.05),
  };
}

export function isUuid(value) { return UUID_RE.test(String(value || "")); }
export function isDigest(value) { return /^[0-9a-f]{64}$/.test(String(value || "")); }
