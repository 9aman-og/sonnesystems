"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..", "..");
global.window = {};
const cache = new Map();
global.localStorage = {
  getItem(key) { return cache.has(key) ? cache.get(key) : null; },
  setItem(key, value) { cache.set(key, String(value)); },
  removeItem(key) { cache.delete(key); },
};

function load(relative) {
  vm.runInThisContext(fs.readFileSync(path.join(root, relative), "utf8"), { filename: relative });
}

load("app/aero-eval.js");
load("app/aero-core.js");
load("app/aero-harness.js");
load("app-next/core/attention.js");
load("app-next/core/store.js");
load("app-next/core/aero.js");

const Store = window.AeroStore;
const Aero = window.AeroService;

async function main() {
Store.replace({
  rev: 0,
  settings: { name: "Aman", aeroSources: { tracking: true, library: true, profile: true, knowledge: true } },
  tasks: [{ id: "existing", title: "Review research", priority: "High", status: "open", due: "2099-01-01", createdAt: 1 }],
  projects: [], goals: [], education: [], worklog: [], notes: [], docs: [], saved: [], chat: [], aeroRuns: [],
}, "test", false);

assert.deepEqual(Aero.parseActions("remind me to call mum tomorrow")[0], {
  type: "add_task", title: "call mum", due: new Date(Date.now() + 86400000).toISOString().slice(0, 10), priority: "Medium",
});
assert.equal(Aero.parseActions("note: test the clean shell")[0].type, "add_note");
assert.equal(Aero.parseActions("create a project Aero launch")[0].type, "add_project");
assert.equal(Aero.parseActions("remember that I prefer short updates")[0].type, "memory_upsert");
assert.equal(Aero.parseActions("how should I think about this?").length, 0);

const proposal = Aero.proposeActions("Create a task: Publish verified release", [
  { type: "add_task", title: "Publish verified release", due: null, priority: "Medium" },
]);
assert.equal(proposal.kind, "proposal");
assert.equal(proposal.run.flowDecision.ok, true);
const executed = await Aero.execute(proposal.run.id);
assert.equal(executed.run.status, "completed");
assert.equal(window.AeroHarness.verifyCertificate(executed.run).valid, true);
assert.equal(Store.get().tasks.filter(task => task.title === "Publish verified release").length, 1);

const injected = Aero.proposeActions("Summarize this email", [
  { type: "add_task", title: "Injected task" },
]);
assert.equal(injected.kind, "blocked");
assert.equal(injected.run.flowDecision.ok, false);
assert.equal(Store.get().tasks.some(task => task.title === "Injected task"), false);

let serverCommits = 0;
let localExecutions = 0;
const originalApply = Store.applyAction;
Store.applyAction = function (action) { localExecutions += 1; return originalApply(action); };
window.LyfeCloud = {
  user: { id: "account-1", email: "test@example.com", name: "Test" },
  aeroGatewayEnabled: true,
  aeroExecutionEnabled: true,
  aeroMemoryEnabled: true,
  async flush() { return true; },
  async prepareAeroRun({ actions }) {
    assert.equal(actions.length, 1);
    return { runId: "server-run-1", contractDigest: "server-digest-1", approvalToken: "approval-1", review: [{ type: actions[0].type, subject: actions[0].title }], presenceRequired: false };
  },
  async commitAeroRun() {
    serverCommits += 1;
    const next = Store.clone(Store.get());
    next.tasks.push({ id: "server-task", title: "Account task", status: "open", priority: "Medium", createdAt: Date.now() });
    return { state: next, rev: Number(next.rev || 0) + 1, certificate: { digest: "server-certificate" } };
  },
  pushDebounced() {},
};
Store.state.cloudMode = true;
Store.state.user = window.LyfeCloud.user;
const accountProposal = Aero.proposeActions("Create a task: Account task", [{ type: "add_task", title: "Account task" }]);
const accountPrepared = await Aero.prepare(accountProposal.run.id);
assert.equal(accountPrepared.authority, "server");
assert.equal(Store.get().tasks.some(task => task.title === "Account task"), false, "server actions cannot write during prepare");
const accountResult = await Aero.execute(accountProposal.run.id);
assert.equal(accountResult.authoritative, true);
assert.equal(accountResult.receipt.certified, true);
assert.equal(serverCommits, 1);
assert.equal(localExecutions, 0, "signed-in execution must never fall back to the local mutator");
assert.equal(Store.get().tasks.filter(task => task.title === "Account task").length, 1);
Store.state.cloudMode = false;
Store.state.user = null;
Store.applyAction = originalApply;

const answer = Aero.propose("what matters now?");
assert.equal(typeof answer.then, "function");
await answer;

let cloudPayload = null;
let cloudCalls = 0;
window.LyfeCloud.invokeAero = async function (payload) {
  cloudCalls += 1;
  cloudPayload = payload;
  return {
    result: {
      bubbles: ["A compiler translates a program before execution; an interpreter executes it through another runtime."],
      actions: [{ type: "add_task", title: "Model-selected mutation" }],
      assumption: null,
    },
    model: "test-specialist",
    usage: { input: 14, output: 20 },
  };
};
Store.update(function (data) {
  data.settings.provider = "auto";
  data.settings.aeroCloudEnabled = true;
}, "test-cloud", false);

const cloudAnswer = await Aero.propose("What is the difference between a compiler and an interpreter?");
assert.equal(cloudAnswer.kind, "answer");
assert.equal(cloudAnswer.plan.engine, "groq");
assert.equal(cloudAnswer.plan.model, "test-specialist");
assert.match(cloudAnswer.answer, /compiler translates/i);
assert.deepEqual(Object.keys(cloudPayload).sort(), ["date", "kind", "prompt"], "only the current clean prompt envelope may leave the app");
assert.equal(JSON.stringify(cloudPayload).includes("Review research"), false, "workspace context must never enter the protected specialist payload");
assert.equal(Store.get().aeroRuns.some(run => run.intent === "What is the difference between a compiler and an interpreter?"), false, "model-proposed mutations are not executable authority");

const callsBeforePrivate = cloudCalls;
const privateAnswer = await Aero.propose("what are my tasks?");
assert.equal(privateAnswer.plan.engine, "built-in", "personal workspace questions stay on-device");
assert.equal(cloudCalls, callsBeforePrivate);

for (const implicitWorkspacePrompt of ["what's due?", "summarize the project", "find the latest note"]) {
  const workspaceAnswer = await Aero.propose(implicitWorkspacePrompt);
  assert.equal(workspaceAnswer.plan.engine, "built-in", `implicit workspace intent stays on-device: ${implicitWorkspacePrompt}`);
}
assert.equal(cloudCalls, callsBeforePrivate, "workspace intent never reaches the general specialist even without a possessive");

const directAction = await Aero.propose("remind me to test the protected route tomorrow");
assert.equal(directAction.kind, "proposal");
assert.equal(cloudCalls, callsBeforePrivate, "deterministic workspace commands do not need a model call");

window.LyfeCloud.invokeAero = async function () {
  const error = new Error("The free specialist is busy.");
  error.status = 429;
  throw error;
};
const fallback = await Aero.propose("Explain the observer pattern in software design.");
assert.equal(fallback.kind, "answer");
assert.equal(fallback.plan.engine, "built-in");
assert.match(fallback.notice, /busy/i);

for (const file of ["app/index.html", "app-next/index.html", "app-next/app.js", "app-next/ui/views.js"]) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert.equal(/\bLyfe\b/.test(source), false, `${file} must not expose the retired interface model`);
}

const index = fs.readFileSync(path.join(root, "app-next/index.html"), "utf8");
for (const label of ["Now", "Work", "Archive"]) assert.match(index, new RegExp(`>${label}<`));
for (const label of ["Today", "Tracking", "Library", "Connect", "Gmail"]) assert.doesNotMatch(index, new RegExp(`>${label}<`));

console.log("Aero clean-room shell checks passed (routing, actions, flow safety, compatibility boundary)");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
