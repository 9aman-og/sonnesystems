"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = {};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "aero-core.js"), "utf8"), { filename: "aero-core.js" });
const Aero = window.AeroCore;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function active(state) { return state.memories.filter(memory => memory.status === "active" || memory.status === "provisional"); }
function byClaim(state, value) { return state.memories.find(memory => memory.claim === value); }

let state = Aero.freshState();
assert.equal(state.version, 2);
assert.equal(state.memoryRevision, 0);
assert.equal(Aero.verifyMemoryJournal(state).valid, true);

state = Aero.upsertMemory(state, {
  type: "semantic", scope: "global", claim: "My timezone is IST",
  sourceMode: "explicit", sourceRefs: [{ kind: "user-explicit", id: "teach-1", label: "Direct correction", at: Date.now() }],
});
const ist = byClaim(state, "My timezone is IST");
assert.ok(ist);
assert.equal(ist.status, "active");
assert.equal(ist.memoryKey, "semantic|global|slot:timezone");
assert.equal(ist.revision, 1);
assert.equal(state.memoryRevision, 1);
assert.equal(state.memoryJournal.length, 1);
assert.equal(state.memoryJournal[0].kind, "create");
assert.equal(Aero.verifyMemoryJournal(state).valid, true);

state = Aero.upsertMemory(state, {
  type: "semantic", scope: "global", claim: "My timezone is PST",
  sourceMode: "explicit", sourceRefs: [{ kind: "user-explicit", id: "teach-2", label: "Moved timezone", at: Date.now() }],
});
const pst = byClaim(state, "My timezone is PST");
assert.equal(byClaim(state, "My timezone is IST").status, "superseded");
assert.equal(byClaim(state, "My timezone is IST").supersededBy, pst.id);
assert.deepEqual(pst.supersedes, [ist.id]);
assert.equal(pst.status, "active");
assert.equal(state.memoryJournal.at(-1).kind, "supersede");

const pack = Aero.contextPack({
  aero: state, surface: "aero",
  lyfe: { tasks: [], projects: [], goals: [], notes: [], docs: [], saved: [], settings: {} },
});
assert.ok(pack.memories.some(memory => memory.claim === "My timezone is PST"));
assert.ok(!pack.memories.some(memory => memory.claim === "My timezone is IST"), "superseded memories must not reach the prompt");

state = Aero.upsertMemory(state, {
  type: "procedural", scope: "global", claim: "Schedule focus blocks at 9 AM local time",
  memoryKey: "procedural|global|focus-time", dependsOn: [pst.id], sourceMode: "explicit",
});
const focus = byClaim(state, "Schedule focus blocks at 9 AM local time");
assert.deepEqual(focus.dependsOn, [pst.id]);
state = Aero.upsertMemory(state, {
  type: "semantic", scope: "global", claim: "My timezone is UTC", sourceMode: "explicit",
});
assert.equal(byClaim(state, "My timezone is PST").status, "superseded");
assert.equal(byClaim(state, "Schedule focus blocks at 9 AM local time").status, "invalidated");
assert.deepEqual(byClaim(state, "Schedule focus blocks at 9 AM local time").invalidatedBy, [pst.id]);

// Ambiguous preferences do not share a slot and therefore cannot silently overwrite.
let preferences = Aero.freshState();
preferences = Aero.upsertMemory(preferences, { type: "semantic", claim: "I prefer short updates", sourceMode: "explicit" });
preferences = Aero.upsertMemory(preferences, { type: "semantic", claim: "I prefer quiet mornings", sourceMode: "explicit" });
assert.equal(active(preferences).length, 2);
assert.notEqual(preferences.memories[0].memoryKey, preferences.memories[1].memoryKey);

// Inference cannot displace a direct user statement. It is held as disputed.
let authority = Aero.freshState();
authority = Aero.upsertMemory(authority, {
  type: "semantic", claim: "Send concise updates", memoryKey: "semantic|global|update-style", sourceMode: "explicit",
});
authority = Aero.upsertMemory(authority, {
  type: "semantic", claim: "Send detailed updates", memoryKey: "semantic|global|update-style", sourceMode: "inferred",
  sourceRefs: [{ kind: "behavioral-outcome", id: "ep-inferred", label: "One observed outcome", at: Date.now() }],
});
assert.equal(byClaim(authority, "Send concise updates").status, "active");
assert.equal(byClaim(authority, "Send detailed updates").status, "disputed");
assert.equal(active(authority).length, 1);
authority = Aero.upsertMemory(authority, {
  type: "semantic", claim: "Send detailed updates", memoryKey: "semantic|global|update-style", sourceMode: "explicit",
  sourceRefs: [{ kind: "user-explicit", id: "teach-detailed", label: "Direct confirmation", at: Date.now() }],
});
assert.equal(byClaim(authority, "Send detailed updates").status, "active");
assert.equal(byClaim(authority, "Send concise updates").status, "superseded");
assert.equal(active(authority).length, 1, "direct confirmation resolves every competing active revision");

// The latest transaction can be restored if no newer revision depends on it.
let recoveryState = Aero.freshState();
recoveryState = Aero.upsertMemory(recoveryState, { type: "semantic", claim: "My timezone is IST", sourceMode: "explicit" });
recoveryState = Aero.upsertMemory(recoveryState, { type: "semantic", claim: "My timezone is PST", sourceMode: "explicit" });
const replacementTransaction = recoveryState.memoryJournal.at(-1).id;
const recovery = Aero.recoverMemoryTransaction(recoveryState, replacementTransaction);
assert.equal(recovery.recovered, true);
recoveryState = recovery.aero;
assert.equal(byClaim(recoveryState, "My timezone is IST").status, "active");
assert.equal(byClaim(recoveryState, "My timezone is PST"), undefined);
assert.equal(recoveryState.memoryJournal.at(-1).kind, "recovery");
assert.equal(recoveryState.memoryJournal.at(-1).reverts, replacementTransaction);
assert.equal(Aero.verifyMemoryJournal(recoveryState).valid, true);

// A stale rollback cannot overwrite a newer commit.
let staleRecovery = Aero.freshState();
staleRecovery = Aero.upsertMemory(staleRecovery, { type: "semantic", claim: "My timezone is IST", sourceMode: "explicit" });
staleRecovery = Aero.upsertMemory(staleRecovery, { type: "semantic", claim: "My timezone is PST", sourceMode: "explicit" });
const staleTransaction = staleRecovery.memoryJournal.at(-1).id;
staleRecovery = Aero.upsertMemory(staleRecovery, { type: "semantic", claim: "My timezone is UTC", sourceMode: "explicit" });
const staleAttempt = Aero.recoverMemoryTransaction(staleRecovery, staleTransaction);
assert.equal(staleAttempt.recovered, false);
assert.match(staleAttempt.reason, /newer memory revision/i);
assert.equal(byClaim(staleAttempt.aero, "My timezone is UTC").status, "active");

// A later live dependency blocks rollback even when the root itself is unchanged.
let dependencyRecovery = Aero.freshState();
dependencyRecovery = Aero.upsertMemory(dependencyRecovery, { type: "semantic", claim: "Launch date is Friday", memoryKey: "launch-date", sourceMode: "explicit" });
const rootTransaction = dependencyRecovery.memoryJournal.at(-1).id;
const launchDate = byClaim(dependencyRecovery, "Launch date is Friday");
dependencyRecovery = Aero.upsertMemory(dependencyRecovery, {
  type: "project", claim: "Prepare the Thursday launch brief", memoryKey: "launch-brief",
  dependsOn: [launchDate.id], sourceMode: "explicit",
});
const dependencyRollback = Aero.recoverMemoryTransaction(dependencyRecovery, rootTransaction);
assert.equal(dependencyRollback.recovered, false);
assert.match(dependencyRollback.reason, /newer memory revision depends/i);
assert.equal(byClaim(dependencyRollback.aero, "Prepare the Thursday launch brief").status, "active");

// Missing, stale, and cyclic dependency declarations never enter usable context.
let dependencySafety = Aero.freshState();
dependencySafety = Aero.upsertMemory(dependencySafety, {
  type: "project", claim: "Draft from a missing source", memoryKey: "missing-dependent",
  dependsOn: ["missing-memory"], sourceMode: "explicit",
});
assert.equal(byClaim(dependencySafety, "Draft from a missing source").status, "invalidated");
dependencySafety = Aero.upsertMemory(dependencySafety, { type: "semantic", claim: "Source A", memoryKey: "source", sourceMode: "explicit" });
const sourceA = byClaim(dependencySafety, "Source A");
dependencySafety = Aero.upsertMemory(dependencySafety, { type: "project", claim: "Child of A", memoryKey: "child-a", dependsOn: [sourceA.id], sourceMode: "explicit" });
const childA = byClaim(dependencySafety, "Child of A");
dependencySafety = Aero.upsertMemory(dependencySafety, { type: "semantic", claim: "Source A", memoryKey: "source", dependsOn: [childA.id], sourceMode: "explicit" });
assert.equal(byClaim(dependencySafety, "Source A").status, "invalidated");
assert.equal(byClaim(dependencySafety, "Child of A").status, "invalidated");
assert.ok(!Aero.contextPack({ aero: dependencySafety, lyfe: { tasks: [], projects: [], goals: [], notes: [], docs: [], saved: [], settings: {} } }).memories.some(memory => /Source A|Child of A|missing source/.test(memory.claim)));

// Forget scrubs the claim from every journal image and invalidates dependants.
let privacy = Aero.freshState();
privacy = Aero.upsertMemory(privacy, { type: "semantic", claim: "My private alias is Nova", sourceMode: "explicit" });
const alias = byClaim(privacy, "My private alias is Nova");
privacy = Aero.upsertMemory(privacy, {
  type: "project", claim: "Use Nova in the launch draft", memoryKey: "project|global|launch-alias",
  dependsOn: [alias.id], sourceMode: "explicit",
});
privacy = Aero.forgetMemory(privacy, alias.id);
assert.equal(byClaim(privacy, "My private alias is Nova"), undefined);
assert.equal(byClaim(privacy, "Use Nova in the launch draft").status, "invalidated");
assert.ok(privacy.memoryJournal.every(transaction => transaction.changes.every(change => {
  if (change.memoryId !== alias.id) return true;
  return (!change.before || change.before.redacted === true) && (!change.after || change.after.redacted === true);
})), "privacy deletion must scrub historic snapshots");
const forgetTransaction = privacy.memoryJournal.at(-1);
assert.equal(forgetTransaction.kind, "forget");
assert.equal(forgetTransaction.reversible, false);
assert.equal(Aero.recoverMemoryTransaction(privacy, forgetTransaction.id).recovered, false);
assert.equal(Aero.verifyMemoryJournal(privacy).valid, true);

// A corrupted journal is visible and cannot be used for recovery.
const corrupted = clone(recoveryState);
corrupted.memoryJournal[0].reason = "silently rewritten";
assert.equal(Aero.verifyMemoryJournal(corrupted).valid, false);
assert.equal(Aero.recoverMemoryTransaction(corrupted, corrupted.memoryJournal[0].id).recovered, false);
const reordered = clone(recoveryState);
reordered.memoryJournal.reverse();
assert.equal(Aero.verifyMemoryJournal(reordered).valid, false, "fingerprint chain detects transaction reordering");

// Re-rating one episode changes the same procedural memory transactionally.
let learned = Aero.freshState();
let episode = Aero.beginEpisode(learned, "same reminder", "today", "ctx-memory");
learned = Aero.observeOutcome(episode.aero, episode.episode.id, "accepted", { actionTypes: ["add_task"] });
const learnedMemory = learned.memories[0];
const journalBeforeDuplicate = learned.memoryJournal.length;
learned = Aero.observeOutcome(learned, episode.episode.id, "helpful", { actionTypes: ["add_task"] });
assert.equal(learned.memoryJournal.length, journalBeforeDuplicate, "same-polarity feedback is idempotent");
learned = Aero.upsertMemory(learned, {
  type: "procedural", claim: "Auto-label the usual reminder", memoryKey: "procedural|today|dependent-reminder",
  dependsOn: [learnedMemory.id], sourceMode: "explicit",
});
learned = Aero.observeOutcome(learned, episode.episode.id, "rejected", { actionTypes: ["add_task"] });
assert.equal(learned.memories.find(memory => memory.id === learnedMemory.id).status, "disputed");
assert.equal(byClaim(learned, "Auto-label the usual reminder").status, "invalidated");
assert.equal(Aero.verifyMemoryJournal(learned).valid, true);

const metrics = Aero.metrics(state);
assert.ok(metrics.supersededMemories >= 2);
assert.ok(metrics.invalidatedMemories >= 1);
assert.ok(metrics.memoryTransactions >= 4);
assert.equal(metrics.memoryJournalValid, true);

const legacy = Aero.normalize({ version: 1, memories: [{ id: "legacy", claim: "Legacy fact", status: "active" }] });
assert.equal(legacy.version, 2);
assert.ok(legacy.memories[0].memoryKey);
assert.deepEqual(legacy.memoryJournal, []);

// A deterministic mixed-mutation sweep guards invariants across longer state histories.
let seed = 0xA3E0C0DE;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
}
let swept = Aero.freshState();
for (let index = 0; index < 240; index += 1) {
  const slot = Math.floor(random() * 6);
  const operation = Math.floor(random() * 6);
  if (operation <= 1) {
    swept = Aero.upsertMemory(swept, {
      type: "semantic", memoryKey: `sweep-slot-${slot}`,
      claim: `Sweep slot ${slot} value ${Math.floor(random() * 5)}`,
      sourceMode: operation === 0 ? "explicit" : "inferred",
    });
  } else if (operation === 2) {
    const usableRoots = swept.memories.filter(memory => memory.status === "active" || memory.status === "provisional");
    const root = usableRoots.length ? usableRoots[Math.floor(random() * usableRoots.length)] : null;
    swept = Aero.upsertMemory(swept, {
      type: "project", memoryKey: `sweep-dependent-${index}`,
      claim: `Sweep dependent ${index}`,
      dependsOn: [root ? root.id : `missing-${index}`], sourceMode: "explicit",
    });
  } else if (operation === 3 && swept.memories.length) {
    const target = swept.memories[Math.floor(random() * swept.memories.length)];
    swept = Aero.forgetMemory(swept, target.id);
  } else if (operation === 4 && swept.memoryJournal.length) {
    const target = swept.memoryJournal[Math.floor(random() * swept.memoryJournal.length)];
    swept = Aero.recoverMemoryTransaction(swept, target.id).aero;
  } else {
    const started = Aero.beginEpisode(swept, `sweep ${slot}`, "aero", `ctx-sweep-${index}`);
    swept = Aero.observeOutcome(started.aero, started.episode.id, random() > 0.25 ? "accepted" : "rejected", { actionTypes: ["add_task"] });
  }

  assert.equal(Aero.verifyMemoryJournal(swept).valid, true, `journal stays valid after sweep mutation ${index}`);
  if (swept.memoryJournal.length) assert.equal(swept.memoryJournal.at(-1).revision, swept.memoryRevision);
  const usable = swept.memories.filter(memory => memory.status === "active" || memory.status === "provisional");
  const liveByKey = new Map();
  usable.forEach(memory => {
    assert.equal(liveByKey.has(memory.memoryKey), false, `only one prompt-usable revision exists for ${memory.memoryKey}`);
    liveByKey.set(memory.memoryKey, memory);
  });
  const byId = new Map(swept.memories.map(memory => [memory.id, memory]));
  usable.forEach(memory => memory.dependsOn.forEach(dependencyId => {
    const dependency = byId.get(dependencyId);
    assert.ok(dependency && (dependency.status === "active" || dependency.status === "provisional"), `usable memory ${memory.id} has only usable dependencies`);
  }));
}

console.log("Aero Memory v0.2 transactional checks passed (22 scenario groups plus 240 mixed mutations)");
