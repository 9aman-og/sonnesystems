"use strict";

/* Deterministic memory-governance benchmark inspired by the failure classes
   in STALE and MemTxn. The control is an append-only memory list, not a
   measurement of any named third-party system. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = {};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "aero-core.js"), "utf8"), { filename: "aero-core.js" });
const Aero = window.AeroCore;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function get(state, claim) { return state.memories.find(memory => memory.claim === claim); }
function usable(state) { return state.memories.filter(memory => memory.status === "active" || memory.status === "provisional"); }
function baseLyfe() { return { tasks: [], projects: [], goals: [], notes: [], docs: [], saved: [], settings: {} }; }

function naiveState() { return { memories: [], history: [], feedback: [] }; }
function naiveRemember(state, memory) {
  const value = { id: `n${state.memories.length + 1}`, status: memory.status || "active", ...clone(memory) };
  state.memories.push(value); state.history.push(clone(value)); return value;
}
function naiveForget(state, id) { state.memories = state.memories.filter(memory => memory.id !== id); }

const scenarios = [
  {
    id: "explicit-correction-is-exclusive", category: "conflict",
    baseline() {
      const state = naiveState(); naiveRemember(state, { claim: "My timezone is IST" }); naiveRemember(state, { claim: "My timezone is UTC" });
      return state.memories.filter(memory => memory.status === "active").length === 1;
    },
    aero() {
      let state = Aero.freshState();
      state = Aero.upsertMemory(state, { type: "semantic", claim: "My timezone is IST", sourceMode: "explicit" });
      state = Aero.upsertMemory(state, { type: "semantic", claim: "My timezone is UTC", sourceMode: "explicit" });
      return get(state, "My timezone is IST").status === "superseded" && get(state, "My timezone is UTC").status === "active" && usable(state).length === 1;
    },
  },
  {
    id: "superseded-fact-stays-out-of-context", category: "retrieval",
    baseline() {
      const state = naiveState(); naiveRemember(state, { claim: "My timezone is IST" }); naiveRemember(state, { claim: "My timezone is UTC" });
      return !state.memories.some(memory => memory.claim === "My timezone is IST");
    },
    aero() {
      let state = Aero.freshState();
      state = Aero.upsertMemory(state, { type: "semantic", claim: "My timezone is IST", sourceMode: "explicit" });
      state = Aero.upsertMemory(state, { type: "semantic", claim: "My timezone is UTC", sourceMode: "explicit" });
      const context = Aero.contextPack({ aero: state, lyfe: baseLyfe(), surface: "aero" });
      return context.memories.some(memory => memory.claim === "My timezone is UTC") && !context.memories.some(memory => memory.claim === "My timezone is IST");
    },
  },
  {
    id: "dependency-invalidation", category: "invalidation",
    baseline() {
      const state = naiveState(); const root = naiveRemember(state, { claim: "My timezone is IST" });
      naiveRemember(state, { claim: "Schedule at 9 local", dependsOn: [root.id] }); naiveRemember(state, { claim: "My timezone is UTC" });
      return state.memories.find(memory => memory.claim === "Schedule at 9 local").status === "invalidated";
    },
    aero() {
      let state = Aero.freshState(); state = Aero.upsertMemory(state, { type: "semantic", claim: "My timezone is IST", sourceMode: "explicit" });
      const root = get(state, "My timezone is IST");
      state = Aero.upsertMemory(state, { type: "procedural", claim: "Schedule at 9 local", memoryKey: "proc|schedule", dependsOn: [root.id], sourceMode: "explicit" });
      state = Aero.upsertMemory(state, { type: "semantic", claim: "My timezone is UTC", sourceMode: "explicit" });
      return get(state, "Schedule at 9 local").status === "invalidated";
    },
  },
  {
    id: "multi-hop-cascade", category: "invalidation",
    baseline() {
      const state = naiveState(); const root = naiveRemember(state, { claim: "Root" });
      const child = naiveRemember(state, { claim: "Child", dependsOn: [root.id] }); naiveRemember(state, { claim: "Grandchild", dependsOn: [child.id] });
      naiveRemember(state, { claim: "Root changed" });
      return state.memories.filter(memory => memory.claim !== "Root changed").every(memory => memory.status === "invalidated");
    },
    aero() {
      let state = Aero.freshState(); state = Aero.upsertMemory(state, { type: "semantic", claim: "Root A", memoryKey: "root", sourceMode: "explicit" });
      const root = get(state, "Root A");
      state = Aero.upsertMemory(state, { type: "project", claim: "Child", memoryKey: "child", dependsOn: [root.id], sourceMode: "explicit" });
      const child = get(state, "Child");
      state = Aero.upsertMemory(state, { type: "procedural", claim: "Grandchild", memoryKey: "grandchild", dependsOn: [child.id], sourceMode: "explicit" });
      state = Aero.upsertMemory(state, { type: "semantic", claim: "Root B", memoryKey: "root", sourceMode: "explicit" });
      return get(state, "Child").status === "invalidated" && get(state, "Grandchild").status === "invalidated";
    },
  },
  {
    id: "stale-dependency-held-out", category: "invalidation",
    baseline() {
      const state = naiveState(); const oldRoot = naiveRemember(state, { claim: "Source A", status: "superseded" });
      naiveRemember(state, { claim: "Derived from A", dependsOn: [oldRoot.id] });
      return state.memories.at(-1).status === "invalidated";
    },
    aero() {
      let state = Aero.freshState(); state = Aero.upsertMemory(state, { type: "semantic", claim: "Source A", memoryKey: "source", sourceMode: "explicit" });
      const oldRoot = get(state, "Source A");
      state = Aero.upsertMemory(state, { type: "semantic", claim: "Source B", memoryKey: "source", sourceMode: "explicit" });
      state = Aero.upsertMemory(state, { type: "project", claim: "Derived from A", memoryKey: "derived-a", dependsOn: [oldRoot.id], sourceMode: "explicit" });
      const context = Aero.contextPack({ aero: state, lyfe: baseLyfe(), surface: "aero" });
      return get(state, "Derived from A").status === "invalidated" && !context.memories.some(memory => memory.claim === "Derived from A");
    },
  },
  {
    id: "inference-cannot-overwrite-user", category: "authority",
    baseline() {
      const state = naiveState(); naiveRemember(state, { claim: "Concise", sourceMode: "explicit" }); naiveRemember(state, { claim: "Detailed", sourceMode: "inferred" });
      return state.memories.at(-1).status === "disputed";
    },
    aero() {
      let state = Aero.freshState();
      state = Aero.upsertMemory(state, { type: "semantic", claim: "Concise", memoryKey: "update-style", sourceMode: "explicit" });
      state = Aero.upsertMemory(state, { type: "semantic", claim: "Detailed", memoryKey: "update-style", sourceMode: "inferred" });
      return get(state, "Concise").status === "active" && get(state, "Detailed").status === "disputed";
    },
  },
  {
    id: "ambiguous-preferences-coexist", category: "conservatism",
    baseline() {
      const state = naiveState(); naiveRemember(state, { claim: "I prefer short updates" }); naiveRemember(state, { claim: "I prefer quiet mornings" });
      return state.memories.length === 2;
    },
    aero() {
      let state = Aero.freshState(); state = Aero.upsertMemory(state, { type: "semantic", claim: "I prefer short updates", sourceMode: "explicit" });
      state = Aero.upsertMemory(state, { type: "semantic", claim: "I prefer quiet mornings", sourceMode: "explicit" });
      return usable(state).length === 2 && state.memories[0].memoryKey !== state.memories[1].memoryKey;
    },
  },
  {
    id: "journal-corruption-detected", category: "integrity",
    baseline() { return false; },
    aero() {
      let state = Aero.upsertMemory(Aero.freshState(), { type: "semantic", claim: "Fact", sourceMode: "explicit" });
      state = clone(state); state.memoryJournal[0].reason = "rewritten";
      return !Aero.verifyMemoryJournal(state).valid;
    },
  },
  {
    id: "journal-reordering-detected", category: "integrity",
    baseline() { return false; },
    aero() {
      let state = Aero.freshState();
      state = Aero.upsertMemory(state, { type: "semantic", claim: "Fact one", sourceMode: "explicit" });
      state = Aero.upsertMemory(state, { type: "semantic", claim: "Fact two", sourceMode: "explicit" });
      state = clone(state); state.memoryJournal.reverse();
      return !Aero.verifyMemoryJournal(state).valid;
    },
  },
  {
    id: "latest-commit-recovery", category: "recovery",
    baseline() { return false; },
    aero() {
      let state = Aero.freshState(); state = Aero.upsertMemory(state, { type: "semantic", claim: "My timezone is IST", sourceMode: "explicit" });
      state = Aero.upsertMemory(state, { type: "semantic", claim: "My timezone is UTC", sourceMode: "explicit" });
      const recovered = Aero.recoverMemoryTransaction(state, state.memoryJournal.at(-1).id);
      return recovered.recovered && get(recovered.aero, "My timezone is IST").status === "active" && !get(recovered.aero, "My timezone is UTC");
    },
  },
  {
    id: "stale-recovery-blocked", category: "recovery",
    baseline() { return false; },
    aero() {
      let state = Aero.freshState(); state = Aero.upsertMemory(state, { type: "semantic", claim: "A", memoryKey: "slot", sourceMode: "explicit" });
      state = Aero.upsertMemory(state, { type: "semantic", claim: "B", memoryKey: "slot", sourceMode: "explicit" });
      const oldTransaction = state.memoryJournal.at(-1).id;
      state = Aero.upsertMemory(state, { type: "semantic", claim: "C", memoryKey: "slot", sourceMode: "explicit" });
      const attempt = Aero.recoverMemoryTransaction(state, oldTransaction);
      return !attempt.recovered && /newer memory revision/i.test(attempt.reason) && get(attempt.aero, "C").status === "active";
    },
  },
  {
    id: "dependent-recovery-blocked", category: "recovery",
    baseline() { return false; },
    aero() {
      let state = Aero.freshState();
      state = Aero.upsertMemory(state, { type: "semantic", claim: "Launch Friday", memoryKey: "launch", sourceMode: "explicit" });
      const root = get(state, "Launch Friday"); const rootTransaction = state.memoryJournal.at(-1).id;
      state = Aero.upsertMemory(state, { type: "project", claim: "Prepare Thursday", memoryKey: "prepare", dependsOn: [root.id], sourceMode: "explicit" });
      const attempt = Aero.recoverMemoryTransaction(state, rootTransaction);
      return !attempt.recovered && /depends on this state/i.test(attempt.reason) && get(attempt.aero, "Prepare Thursday").status === "active";
    },
  },
  {
    id: "privacy-forget-scrubs-history", category: "privacy",
    baseline() {
      const state = naiveState(); const memory = naiveRemember(state, { claim: "Private alias Nova" }); naiveForget(state, memory.id);
      return !JSON.stringify(state).includes("Private alias Nova");
    },
    aero() {
      let state = Aero.upsertMemory(Aero.freshState(), { type: "semantic", claim: "Private alias Nova", sourceMode: "explicit" });
      state = Aero.forgetMemory(state, get(state, "Private alias Nova").id);
      return !JSON.stringify(state).includes("Private alias Nova") && Aero.verifyMemoryJournal(state).valid;
    },
  },
  {
    id: "same-episode-idempotency", category: "adaptation",
    baseline() {
      const state = naiveState(); state.feedback.push({ id: "ep", positive: true }); state.feedback.push({ id: "ep", positive: true });
      return state.feedback.length === 1;
    },
    aero() {
      let state = Aero.freshState(); const started = Aero.beginEpisode(state, "same reminder", "today", "ctx");
      state = Aero.observeOutcome(started.aero, started.episode.id, "accepted", { actionTypes: ["add_task"] });
      const before = state.memoryJournal.length;
      state = Aero.observeOutcome(state, started.episode.id, "helpful", { actionTypes: ["add_task"] });
      return state.memoryJournal.length === before && state.memories[0].successCount === 1;
    },
  },
  {
    id: "disputed-memory-held-out", category: "retrieval",
    baseline() {
      const state = naiveState(); naiveRemember(state, { claim: "Direct", status: "active" }); naiveRemember(state, { claim: "Conflicting", status: "disputed" });
      return state.memories.filter(memory => memory.status === "active").every(memory => memory.claim !== "Conflicting");
    },
    aero() {
      let state = Aero.freshState(); state = Aero.upsertMemory(state, { type: "semantic", claim: "Direct", memoryKey: "slot", sourceMode: "explicit" });
      state = Aero.upsertMemory(state, { type: "semantic", claim: "Conflicting", memoryKey: "slot", sourceMode: "inferred" });
      const context = Aero.contextPack({ aero: state, lyfe: baseLyfe(), surface: "aero" });
      return !context.memories.some(memory => memory.claim === "Conflicting");
    },
  },
  {
    id: "direct-confirmation-resolves-dispute", category: "authority",
    baseline() { return false; },
    aero() {
      let state = Aero.freshState(); state = Aero.upsertMemory(state, { type: "semantic", claim: "Concise", memoryKey: "slot", sourceMode: "explicit" });
      state = Aero.upsertMemory(state, { type: "semantic", claim: "Detailed", memoryKey: "slot", sourceMode: "inferred" });
      state = Aero.upsertMemory(state, { type: "semantic", claim: "Detailed", memoryKey: "slot", sourceMode: "explicit" });
      return get(state, "Detailed").status === "active" && get(state, "Concise").status === "superseded" && usable(state).length === 1;
    },
  },
  {
    id: "legacy-state-migration", category: "durability",
    baseline() { return false; },
    aero() {
      const state = Aero.normalize({ version: 1, memories: [{ id: "old", claim: "Legacy fact", status: "active" }] });
      return state.version === 2 && !!state.memories[0].memoryKey && Array.isArray(state.memoryJournal);
    },
  },
];

const results = scenarios.map(scenario => {
  let baseline = false; let aero = false; let error = "";
  try { baseline = scenario.baseline() === true; } catch (cause) { error += `baseline: ${cause.message}; `; }
  try { aero = scenario.aero() === true; } catch (cause) { error += `aero: ${cause.message}`; }
  return { id: scenario.id, category: scenario.category, appendOnly: baseline, aeroV02: aero, error: error.trim() };
});
const categories = [...new Set(results.map(result => result.category))];
const summary = {
  benchmark: "Aero Transactional Memory Benchmark v0.1",
  comparison: "AppendOnlyMemory control; not a third-party product benchmark",
  scenarios: results.length,
  appendOnly: results.filter(result => result.appendOnly).length,
  aeroV02: results.filter(result => result.aeroV02).length,
  byCategory: Object.fromEntries(categories.map(category => {
    const subset = results.filter(result => result.category === category);
    return [category, { scenarios: subset.length, appendOnly: subset.filter(item => item.appendOnly).length, aeroV02: subset.filter(item => item.aeroV02).length }];
  })),
};

if (process.argv.includes("--json")) console.log(JSON.stringify({ summary, results }, null, 2));
else {
  console.log("Aero Transactional Memory Benchmark v0.1");
  console.log("Control: AppendOnlyMemory (not a competitor-product comparison)\n");
  console.table(results.map(result => ({ scenario: result.id, category: result.category, appendOnly: result.appendOnly ? "PASS" : "FAIL", aero: result.aeroV02 ? "PASS" : "FAIL" })));
  console.log(`Aero v0.2: ${summary.aeroV02}/${summary.scenarios} | AppendOnlyMemory: ${summary.appendOnly}/${summary.scenarios}`);
}

assert.equal(summary.aeroV02, summary.scenarios, "Aero must satisfy every declared transactional-memory invariant");
assert.ok(results.every(result => !result.error), "benchmark scenarios must run without internal errors");
