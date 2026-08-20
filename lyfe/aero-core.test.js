"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = {};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "aero-core.js"), "utf8"), {
  filename: "aero-core.js",
});

const Aero = window.AeroCore;
assert.ok(Aero, "Aero Core should load");

const pack = Aero.contextPack({
  lyfe: {
    tasks: [{ id: "t1", title: "Ship the demo", status: "open", due: "2099-01-01" }],
    projects: [], goals: [], notes: [], docs: [], saved: [], settings: {},
  },
  gmail: [{ id: "m1", sender: "A", subject: "Hello", snippet: "World" }],
  sourcePolicy: { gmail: false },
  surface: "today",
  activeObject: { type: "task", id: "t1", title: "Ship the demo", detail: "High priority" },
});
assert.equal(pack.surface, "today");
assert.ok(pack.sources.some(source => source.id === "today"));
assert.ok(!pack.sources.some(source => source.id === "gmail"), "disabled sources must stay out of the context pack");
assert.equal(pack.activeObject.title, "Ship the demo");
assert.match(Aero.summarizeForPrompt(pack), /\[Active object\] task: Ship the demo/);

assert.equal(Aero.epistemicDecision({ signal: "remind me to email prof tomorrow", context: pack }).mode, "answer",
  "a reminder containing the word email is still an internal task capture");
assert.equal(Aero.epistemicDecision({ signal: "email prof", context: pack }).mode, "preview");
assert.equal(Aero.epistemicDecision({ signal: "send it", context: { sources: [], activeObject: null } }).mode, "clarify");
assert.equal(Aero.validateAction({ type: "send_email", to: "someone@example.com" }), null,
  "external sends are outside the v0 action authority");

let state = Aero.freshState();
let first = Aero.beginEpisode(state, "remind me to email prof tomorrow", "today", "ctx-1");
state = Aero.observeOutcome(first.aero, first.episode.id, "accepted", { actionTypes: ["add_task"] });
state = Aero.observeOutcome(state, first.episode.id, "helpful", { ratedAt: Date.now() });
assert.equal(state.memories.length, 1, "one episode must not create duplicate inferred memories");
assert.equal(state.memories[0].successCount, 1, "multiple positive signals for one episode count once");

let report = Aero.metrics(state);
assert.equal(report.compressionSamples, 0, "one success establishes a baseline; it cannot prove compression");
assert.equal(report.compression, null);

let second = Aero.beginEpisode(state, "same reminder", "today", "ctx-2");
state = Aero.observeOutcome(second.aero, second.episode.id, "helpful", { actionTypes: ["add_task"] });
report = Aero.metrics(state);
assert.equal(report.compressionSamples, 1);
assert.ok(report.compression > 0, "a shorter successful repeat should register positive compression");

let third = Aero.beginEpisode(state, "task call mum", "today", "ctx-3");
state = Aero.observeOutcome(third.aero, third.episode.id, "accepted", { actionTypes: ["add_task"] });
const examples = Aero.trainingExamples(state, [
  { role: "user", text: "remind me to email prof tomorrow", episodeId: first.episode.id },
  { role: "sol", text: "I prepared the task.", episodeId: first.episode.id },
  { role: "user", text: "same reminder", episodeId: second.episode.id },
  { role: "sol", text: "I prepared the usual task.", episodeId: second.episode.id },
  { role: "user", text: "task call mum", episodeId: third.episode.id },
  { role: "sol", text: "I prepared the task.", episodeId: third.episode.id },
]);
assert.equal(examples.length, 2, "manual training export requires explicit helpful feedback, not Apply alone");

console.log("Aero Core v0 checks passed");
