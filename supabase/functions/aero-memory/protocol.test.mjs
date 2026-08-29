import assert from "node:assert/strict";
import test from "node:test";

import {
  ProtocolError,
  digestValue,
  freshState,
  memoryMetrics,
  normalizeOperations,
  prepareMemoryMaterial,
  verifyJournal,
} from "./protocol.mjs";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DAY = 24 * 60 * 60 * 1_000;
const AT = Date.parse("2026-08-29T10:00:00.000Z");

async function prepare(state, revision, operations, requestKey = `memory-request-${revision + 1}`, authorityNow) {
  return prepareMemoryMaterial({
    userId: USER_ID,
    requestKey,
    state,
    revision,
    operations,
    authorityNow,
  });
}

function episode(id, signal, outcome, wordCount, createdAt, actionTypes = ["add_task"]) {
  return {
    id,
    signal,
    surface: "today",
    family: "organize",
    wordCount,
    coldBaseline: wordCount,
    outcome,
    firstPass: ["helpful", "accepted"].includes(outcome),
    actionTypes,
    createdAt,
  };
}

test("canonical digests are stable across object key order", async () => {
  assert.equal(
    await digestValue({ b: 2, a: { d: 4, c: 3 } }),
    await digestValue({ a: { c: 3, d: 4 }, b: 2 }),
  );
});

test("an explicit typed memory is user-authority, inspectable, and exactly bound", async () => {
  const initial = freshState(AT);
  const result = await prepare(initial, 0, [{
    type: "remember",
    memoryType: "project",
    scope: "aero",
    memoryKey: "project|aero|direction",
    claim: "Aero remains model-neutral and private by default.",
  }]);
  assert.equal(result.noChange, false);
  assert.equal(result.targetState.memoryRevision, 1);
  assert.equal(result.targetState.memories.length, 1);
  assert.equal(result.targetState.memories[0].type, "project");
  assert.equal(result.targetState.memories[0].sourceMode, "explicit");
  assert.equal(result.targetState.memories[0].authority, "user");
  assert.equal(result.targetState.memories[0].status, "active");
  assert.equal(result.contract.authority, "user-explicit");
  assert.equal(result.contract.state.baseRevision, 0);
  assert.equal(result.contract.target.digest, result.targetDigest);
  assert.equal(await digestValue(result.targetState), result.targetDigest);
  assert.equal(verifyJournal(result.targetState).valid, true);
});

test("materialization is deterministic for retries and separated by request key", async () => {
  const initial = freshState(AT);
  const operation = [{ type: "remember", claim: "My review mode is concise.", memoryType: "semantic" }];
  const first = await prepare(initial, 0, operation, "memory-retry-fixed");
  const retry = await prepare(initial, 0, operation, "memory-retry-fixed");
  const other = await prepare(initial, 0, operation, "memory-retry-other");
  assert.equal(first.contractDigest, retry.contractDigest);
  assert.equal(first.targetDigest, retry.targetDigest);
  assert.deepEqual(first.targetState, retry.targetState);
  assert.notEqual(first.targetState.memories[0].id, other.targetState.memories[0].id);
});

test("the closed schema rejects capability smuggling and malformed inputs", () => {
  const denied = [
    [{ type: "send_email", claim: "outside memory" }, "MEMORY_CAPABILITY_DENIED"],
    [{ type: "remember", claim: "safe", shell: "calc.exe" }, "MEMORY_UNKNOWN_FIELD"],
    [{ type: "remember", claim: "safe", memoryType: "identity" }, "MEMORY_TYPE"],
    [{ type: "forget", query: "x", wildcard: true }, "MEMORY_UNKNOWN_FIELD"],
    [{ type: "observe", episode: { id: "ep", signal: "ok" }, outcome: "clicked" }, "OUTCOME_INVALID"],
  ];
  for (const [operation, code] of denied) {
    assert.throws(() => normalizeOperations([operation], AT), (error) => error instanceof ProtocolError && error.code === code);
  }
});

test("stale revisions fail closed before a target is generated", async () => {
  await assert.rejects(
    () => prepare(freshState(AT), 4, [{ type: "remember", claim: "Never apply stale state." }]),
    (error) => error instanceof ProtocolError && error.code === "MEMORY_REVISION",
  );
});

test("explicit correction supersedes a competing revision and invalidates dependents", async () => {
  let state = freshState(AT);
  let result = await prepare(state, 0, [{
    type: "remember", claim: "My primary model is local.", memoryKey: "semantic|global|primary-model",
  }], "memory-model-local");
  state = result.targetState;
  const sourceId = state.memories[0].id;
  result = await prepare(state, 1, [{
    type: "remember", memoryType: "procedural", claim: "Route private work through my primary model.",
    memoryKey: "procedural|global|private-route", dependsOn: [sourceId],
  }], "memory-private-route");
  state = result.targetState;
  const dependentId = state.memories.find((memory) => memory.id !== sourceId).id;
  result = await prepare(state, 2, [{
    type: "remember", claim: "My primary model is a hosted specialist.",
    memoryKey: "semantic|global|primary-model",
  }], "memory-model-hosted");
  const corrected = result.targetState;
  assert.equal(corrected.memories.find((memory) => memory.id === sourceId).status, "superseded");
  assert.equal(corrected.memories.find((memory) => memory.id === dependentId).status, "invalidated");
  assert.equal(corrected.memories.filter((memory) => memory.memoryKey === "semantic|global|primary-model" && memory.status === "active").length, 1);
});

test("forgetting removes the claim and scrubs every retained journal image", async () => {
  let result = await prepare(freshState(AT), 0, [{
    type: "remember", claim: "My private codename is Juniper.", memoryKey: "semantic|global|codename",
  }], "memory-private-codename");
  const id = result.targetState.memories[0].id;
  result = await prepare(result.targetState, 1, [{ type: "forget", query: id }], "memory-forget-codename");
  assert.equal(result.targetState.memories.length, 0);
  assert.doesNotMatch(JSON.stringify(result.targetState), /Juniper/i);
  assert.equal(result.targetState.memoryJournal.every((entry) => entry.reversible === false), true);
  assert.equal(verifyJournal(result.targetState).valid, true);
});

test("privacy reset removes memories, episodes, context, and prior journal snapshots", async () => {
  let result = await prepare(freshState(AT), 0, [{
    type: "remember", claim: "A private reset claim.", memoryKey: "semantic|global|reset-me",
  }], "memory-before-reset");
  result.targetState.episodes.push(episode("private-episode", "private shorthand", "helpful", 2, AT));
  result.targetState.lastContext = { private: "context" };
  result = await prepare(result.targetState, 1, [{ type: "reset" }], "memory-reset-all");
  assert.equal(result.targetState.memories.length, 0);
  assert.equal(result.targetState.episodes.length, 0);
  assert.equal(result.targetState.lastContext, null);
  assert.equal(result.targetState.memoryJournal.length, 1);
  assert.doesNotMatch(JSON.stringify(result.targetState), /private reset claim|private shorthand|private.*context/i);
  assert.equal(verifyJournal(result.targetState).valid, true);
});

test("behavioral evidence can only create a bounded candidate, never an explicit fact", async () => {
  const result = await prepare(freshState(AT), 0, [{
    type: "observe",
    episode: episode("episode-1", "same reminder", "pending", 2, AT),
    outcome: "helpful",
  }], "memory-observe-one");
  assert.equal(result.contract.authority, "behavior-only");
  assert.equal(result.targetState.memories.length, 1);
  assert.equal(result.targetState.memories[0].sourceMode, "inferred");
  assert.equal(result.targetState.memories[0].authority, "behavior");
  assert.equal(result.targetState.memories[0].status, "candidate");
  assert.ok(result.targetState.memories[0].confidence < 0.9);
});

test("promotion needs repeated positive evidence across distinct days and no failures", async () => {
  let state = freshState(AT);
  for (let index = 0; index < 3; index += 1) {
    const result = await prepare(state, index, [{
      type: "observe",
      episode: episode(`episode-${index + 1}`, "same reminder", "pending", 2, AT + 40 * DAY),
      outcome: "helpful",
    }], `memory-promotion-${index + 1}`, AT + index * DAY);
    state = result.targetState;
  }
  assert.equal(state.memories[0].successCount, 3);
  assert.ok(state.memories[0].distinctDays.length >= 2);
  assert.equal(state.memories[0].status, "provisional");
  assert.equal(state.memories[0].wasPromoted, true);
  assert.equal(state.memories[0].distinctDays.includes(new Date(AT + 40 * DAY).toISOString().slice(0, 10)), false);
});

test("journal mutation is detected before the corrupted state can be extended", async () => {
  const first = await prepare(freshState(AT), 0, [{ type: "remember", claim: "Integrity matters." }]);
  const tampered = structuredClone(first.targetState);
  tampered.memoryJournal[0].reason = "laundered provenance";
  assert.equal(verifyJournal(tampered).valid, false);
  await assert.rejects(
    () => prepare(tampered, 1, [{ type: "remember", claim: "This must not commit." }], "memory-after-tamper"),
    (error) => error instanceof ProtocolError && error.code === "MEMORY_JOURNAL_INVALID",
  );
});

test("compression includes failed repeats instead of rewarding survivorship", () => {
  const state = freshState(AT);
  state.episodes = [
    episode("base", "please create a reminder for mum tomorrow morning", "helpful", 10, AT),
    episode("repeat", "same reminder", "missed", 2, AT + 1),
  ];
  const metrics = memoryMetrics(state);
  assert.equal(metrics.pairedSamples, 1);
  assert.equal(metrics.compression, 0.8);
  assert.equal(metrics.baselineFirstPassRate, 1);
  assert.equal(metrics.repeatFirstPassRate, 0);
  assert.equal(metrics.intentAccuracyDelta, -1);
  assert.equal(metrics.proofReady, false);
});

test("proof requires enough paired evidence, positive compression, and matched intent accuracy", () => {
  const state = freshState(AT);
  state.episodes.push(episode("base", "please create a reminder for mum tomorrow morning", "helpful", 10, AT));
  for (let index = 1; index < 10; index += 1) {
    state.episodes.push(episode(`repeat-${index}`, "same reminder", "helpful", 2, AT + index));
  }
  const metrics = memoryMetrics(state);
  assert.equal(metrics.scored, 10);
  assert.equal(metrics.pairedSamples, 9);
  assert.equal(metrics.intentAccuracyDelta, 0);
  assert.equal(metrics.compression, 0.8);
  assert.equal(metrics.proofReady, true);
});

test("adversarial mutations cannot widen the memory capability set", () => {
  const types = ["send_email", "run_shell", "delete_account", "browse", "publish", "model_train"];
  for (let index = 0; index < 240; index += 1) {
    assert.throws(
      () => normalizeOperations([{ type: types[index % types.length], claim: `mutation-${index}` }], AT),
      (error) => error.code === "MEMORY_CAPABILITY_DENIED",
    );
  }
});
