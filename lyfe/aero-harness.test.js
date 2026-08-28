"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = {};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "aero-harness.js"), "utf8"), { filename: "aero-harness.js" });

const Harness = window.AeroHarness;
assert.ok(Harness, "Aero Harness should load");

const run = Harness.createRun({
  intent: "Plan tomorrow and save the notes",
  threadId: "thread-1",
  actions: [
    { type: "add_task", title: "Plan tomorrow" },
    { type: "add_note", title: "Tomorrow", body: "Calm plan" },
  ],
});
assert.equal(run.status, "awaiting-approval");
assert.equal(run.steps.length, 2);
assert.equal(Harness.executeApproved(run, () => 1).applied, 0, "unapproved work must not execute");

let approved = Harness.approve(run);
assert.equal(Harness.preflight(approved).ok, true);
let calls = 0;
let result = Harness.executeApproved(approved, () => { calls += 1; return 1; });
assert.equal(result.run.status, "completed");
assert.equal(result.applied, 2);
assert.equal(calls, 2);
assert.equal(result.run.checkpoint.completedKeys.length, 2);
assert.equal(result.run.taskState.unmetStepIds.length, 0);

result = Harness.executeApproved(Object.assign({}, result.run, { status: "running" }), () => { calls += 1; return 1; });
assert.equal(calls, 2, "completed idempotency keys must not replay side effects");
assert.equal(Harness.receipt(result.run).completed, 2);
assert.equal(Harness.receipt(result.run).verified, 2);

let tampered = Harness.approve(Harness.createRun({ actions: [{ type: "add_task", title: "Original" }] }));
tampered.steps[0].action.title = "Changed after approval";
const blocked = Harness.executeApproved(tampered, () => { throw new Error("must not run"); });
assert.equal(blocked.applied, 0);
assert.equal(blocked.run.status, "failed");
assert.match(blocked.failures.join(" "), /changed after approval/i);

const unverifiable = Harness.approve(Harness.createRun({ actions: [{ type: "add_task", title: "Verify me" }] }));
const verifyFailure = Harness.executeApproved(unverifiable, () => ({ applied: 1, verified: false }));
assert.equal(verifyFailure.run.status, "failed", "a write without a satisfied postcondition must fail closed");

const audited = Harness.approve(Harness.createRun({ actions: [{ type: "add_note", title: "Verified note" }] }));
let freshContext;
const auditedResult = Harness.executeApproved(audited, {
  execute: (_action, _key, context) => { freshContext = context; return { applied: 1, evidence: "record-1" }; },
  audit: (step, execution) => ({ verified: execution.evidence === "record-1", facts: [step.acceptance] }),
});
assert.equal(auditedResult.run.status, "completed");
assert.equal(auditedResult.run.taskState.verifiedFacts.length, 1, "only audited facts should enter durable task state");
assert.equal(freshContext.freshContext, true);
assert.equal(Object.prototype.hasOwnProperty.call(freshContext, "taskState"), false, "executor context stays narrow");

let compensated = 0;
let downstreamCalls = 0;
const auditBlocked = Harness.approve(Harness.createRun({ actions: [
  { type: "add_task", title: "Must verify" },
  { type: "add_note", title: "Must not run" },
] }));
const auditBlockedResult = Harness.executeApproved(auditBlocked, {
  execute: () => { downstreamCalls += 1; return { applied: 1 }; },
  audit: () => ({ verified: false }),
  compensate: () => { compensated += 1; },
});
assert.equal(auditBlockedResult.run.status, "failed");
assert.equal(compensated, 1, "failed audits should invoke compensation");
assert.equal(downstreamCalls, 1, "downstream work must stop after an audit failure");

const missingAuditor = Harness.approve(Harness.createRun({ actions: [{ type: "add_task", title: "No self grading" }] }));
const missingAuditorResult = Harness.executeApproved(missingAuditor, { execute: () => ({ applied: 1 }) });
assert.equal(missingAuditorResult.run.status, "failed");
assert.match(missingAuditorResult.failures.join(" "), /auditor/i);

const unsupported = Harness.approve(Harness.createRun({ actions: [{ type: "send_email", to: "outside@example.com" }] }));
const unsupportedResult = Harness.executeApproved(unsupported, () => 1);
assert.equal(unsupportedResult.run.status, "failed");
assert.match(unsupportedResult.failures.join(" "), /unsupported action/i);

let nestedTamper = Harness.approve(Harness.createRun({ actions: [{ type: "add_note", title: "Original", metadata: { project: "Aero", source: "Library" } }] }));
nestedTamper.steps[0].action.metadata.source = "Injected";
assert.match(Harness.executeApproved(nestedTamper, () => 1).failures.join(" "), /changed after approval/i, "nested plan edits must invalidate approval");

const cancelled = Harness.cancel(Harness.createRun({ actions: [{ type: "add_task", title: "Do not add" }] }));
assert.equal(cancelled.status, "cancelled");
assert.equal(cancelled.steps[0].status, "cancelled");

const bounded = Harness.createRun({ actions: Array.from({ length: 20 }, (_, index) => ({ type: "add_task", title: String(index) })) });
assert.equal(bounded.steps.length, Harness.MAX_STEPS, "runs must enforce a hard step budget");

console.log("Aero Harness v0.3 checks passed");
