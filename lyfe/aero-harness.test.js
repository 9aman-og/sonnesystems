"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = {};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "aero-harness.js"), "utf8"), { filename: "aero-harness.js" });

const Harness = window.AeroHarness;
assert.ok(Harness, "Aero Harness should load");
assert.equal(Harness.VERSION, "aero-harness-v0.4");

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function makeEnvironment(options = {}) {
  const ledger = [];
  let executeCount = 0;
  let auditCount = 0;
  let compensateCount = 0;
  const hooks = {
    execute(action, key, context) {
      executeCount += 1;
      if (options.throwOnExecute === executeCount) throw new Error("simulated executor failure");
      assert.equal(context.freshContext, true);
      assert.equal(Object.prototype.hasOwnProperty.call(context, "taskState"), false, "executor context stays narrow");
      assert.equal(Object.isFrozen(context), true, "executor context must be immutable");
      assert.equal(Object.isFrozen(action), true, "action must be immutable");
      const record = { id: `record-${executeCount}`, key, action: clone(action) };
      ledger.push(record);
      return { applied: 1, record };
    },
    audit(step, execution) {
      auditCount += 1;
      if (options.failAudit === auditCount) return { verified: false, integrity: "clean", evidence: [] };
      if (options.dirtyAudit === auditCount) return {
        verified: true, integrity: "uncertain",
        evidence: [{ type: "readback", source: "test-ledger", ref: execution.record.id, claim: step.acceptance, observedAt: Date.now() }],
      };
      if (options.noEvidence === auditCount) return { verified: true, integrity: "clean", evidence: [] };
      if (options.invalidEvidence === auditCount) return {
        verified: true, integrity: "clean", evidence: [{ type: "readback", source: "test-ledger" }],
      };
      return {
        verified: ledger.some(record => record.id === execution.record.id),
        integrity: "clean",
        auditor: "test-readback",
        facts: [step.acceptance],
        evidence: [{
          type: "postcondition-readback", source: "test-ledger", ref: execution.record.id,
          claim: step.acceptance, observedAt: options.staleEvidence === auditCount ? 1 : Date.now(),
        }],
      };
    },
    compensate(execution) {
      compensateCount += 1;
      if (options.failCompensation === compensateCount) return false;
      const index = ledger.findIndex(record => record.id === execution.record.id);
      if (index >= 0) ledger.splice(index, 1);
      return true;
    },
  };
  return {
    hooks, ledger,
    counts: () => ({ execute: executeCount, audit: auditCount, compensate: compensateCount }),
  };
}

function twoStepRun() {
  return Harness.createRun({
    intent: "Plan tomorrow and save the notes",
    threadId: "thread-1",
    actions: [
      { type: "add_task", title: "Plan tomorrow" },
      { type: "add_note", title: "Tomorrow", body: "Calm plan" },
    ],
  });
}

// Hashing is real SHA-256 over the canonical JSON payload, not a label over a weak checksum.
const expectedHash = crypto.createHash("sha256").update(JSON.stringify("Aero ✓"), "utf8").digest("hex");
assert.equal(Harness.digestValue("Aero ✓"), `sha256-${expectedHash}`);

const proposed = twoStepRun();
assert.equal(proposed.status, "awaiting-approval");
assert.equal(proposed.steps.length, 2);
assert.match(proposed.contractDigest, /^sha256-[a-f0-9]{64}$/);
assert.equal(proposed.rollbackPolicy, "all-or-nothing");

const unapproved = Harness.executeApproved(proposed, makeEnvironment().hooks);
assert.equal(unapproved.applied, 0, "unapproved work must not execute");
assert.equal(unapproved.run.status, "failed");
assert.ok(unapproved.issues.some(item => item.code === "RUN_NOT_APPROVED"));

let approved = Harness.approve(proposed);
assert.equal(Harness.preflight(approved).ok, true);
const successEnvironment = makeEnvironment();
let success = Harness.executeApproved(approved, successEnvironment.hooks);
assert.equal(success.run.status, "completed");
assert.equal(success.applied, 2);
assert.equal(successEnvironment.ledger.length, 2);
assert.equal(success.run.taskState.evidenceLedger.length, 2);
assert.equal(success.run.taskState.verifiedFacts.length, 1, "duplicate verified facts are compressed while evidence remains per-step");
assert.equal(success.run.checkpoint.completedKeys.length, 2);
assert.equal(success.run.taskState.unmetStepIds.length, 0);
assert.equal(Harness.verifyCertificate(success.run).valid, true);
assert.equal(Harness.receipt(success.run).certified, true);
assert.equal(Harness.receipt(success.run).verified, 2);
assert.equal(Harness.receipt(success.run).atomic, true);

const replay = clone(success.run);
replay.status = "approved";
const replayResult = Harness.executeApproved(replay, makeEnvironment().hooks);
assert.equal(replayResult.applied, 0);
assert.ok(replayResult.issues.some(item => item.code === "APPROVAL_REPLAY"), "an approval must be single-use");
const replayStateReset = clone(success.run);
replayStateReset.status = "approved";
replayStateReset.approval.useCount = 0;
replayStateReset.approval.consumedAt = 0;
const replayStateResult = Harness.executeApproved(replayStateReset, makeEnvironment().hooks);
assert.ok(replayStateResult.issues.some(item => item.code === "APPROVAL_STATE_CHANGED"), "consumption metadata cannot be reset silently");

function expectContractTamper(mutator, label) {
  const run = Harness.approve(twoStepRun());
  mutator(run);
  const result = Harness.executeApproved(run, makeEnvironment().hooks);
  assert.equal(result.applied, 0, label);
  assert.ok(result.issues.some(item => item.code === "CONTRACT_CHANGED"), label);
}
expectContractTamper(run => { run.steps[0].action.title = "Changed after approval"; }, "action values are bound");
expectContractTamper(run => { run.intent = "A weaker intent"; }, "intent is bound");
expectContractTamper(run => { run.steps[0].acceptance = "Anything happened"; }, "acceptance criteria are bound");
expectContractTamper(run => { run.steps[0].capability = "admin.everything"; }, "capability is bound");
expectContractTamper(run => { run.steps[0].route = "untrusted-remote"; }, "route is bound");
expectContractTamper(run => { run.budget.maxSteps = 999; }, "budget is bound");
expectContractTamper(run => { run.rollbackPolicy = "best-effort"; }, "rollback policy is bound");

const expired = Harness.approve(twoStepRun());
expired.approval.expiresAt = Date.now() - 1;
const expiredResult = Harness.executeApproved(expired, makeEnvironment().hooks);
assert.ok(expiredResult.issues.some(item => item.code === "APPROVAL_EXPIRED"));
const extended = Harness.approve(twoStepRun());
extended.approval.expiresAt += 24 * 60 * 60 * 1000;
const extendedResult = Harness.executeApproved(extended, makeEnvironment().hooks);
assert.ok(extendedResult.issues.some(item => item.code === "APPROVAL_CHANGED"), "approval expiry is part of the consent binding");

const unsupported = Harness.approve(Harness.createRun({ actions: [{ type: "send_email", to: "outside@example.com" }] }));
const unsupportedResult = Harness.executeApproved(unsupported, makeEnvironment().hooks);
assert.ok(unsupportedResult.issues.some(item => item.code === "ACTION_UNSUPPORTED"));

const unknownField = Harness.approve(Harness.createRun({ actions: [{ type: "add_note", title: "Safe", metadata: { injected: true } }] }));
assert.ok(Harness.executeApproved(unknownField, makeEnvironment().hooks).issues.some(item => item.code === "ACTION_UNKNOWN_FIELD"));
const invalidHours = Harness.approve(Harness.createRun({ actions: [{ type: "log_work", text: "Too much", hours: 80 }] }));
assert.ok(Harness.executeApproved(invalidHours, makeEnvironment().hooks).issues.some(item => item.code === "ACTION_HOURS_RANGE"));
const invalidDate = Harness.approve(Harness.createRun({ actions: [{ type: "add_task", title: "Bad date", due: "tomorrow" }] }));
assert.ok(Harness.executeApproved(invalidDate, makeEnvironment().hooks).issues.some(item => item.code === "ACTION_DATE_FORMAT"));

const noHooks = Harness.executeApproved(Harness.approve(twoStepRun()), {});
assert.ok(noHooks.issues.some(item => item.code === "EXECUTOR_MISSING"));
assert.ok(noHooks.issues.some(item => item.code === "AUDITOR_MISSING"));
assert.ok(noHooks.issues.some(item => item.code === "COMPENSATOR_MISSING"));
const noSelfGrade = Harness.executeApproved(Harness.approve(twoStepRun()), () => 1);
assert.ok(noSelfGrade.issues.some(item => item.code === "AUDITOR_MISSING"), "a shorthand executor cannot grade itself");

// A failure after an earlier success restores every side effect in reverse order.
const atomicEnvironment = makeEnvironment({ failAudit: 2 });
const atomicFailure = Harness.executeApproved(Harness.approve(twoStepRun()), atomicEnvironment.hooks);
assert.equal(atomicFailure.run.status, "failed");
assert.equal(atomicFailure.run.transaction.state, "rolled-back");
assert.equal(atomicFailure.applied, 0, "failed atomic work has no net applied changes");
assert.equal(atomicFailure.attemptedApplied, 2);
assert.equal(atomicEnvironment.ledger.length, 0, "all earlier writes are restored");
assert.equal(atomicEnvironment.counts().compensate, 2);
assert.equal(atomicFailure.run.steps[0].status, "rolled-back");
assert.equal(atomicFailure.run.steps[1].status, "rolled-back");
assert.equal(atomicFailure.run.steps[0].audit.valid, false, "rolled-back evidence is retained but invalidated");
assert.equal(atomicFailure.run.taskState.evidenceLedger.length, 0, "aborted evidence cannot cross the commit boundary");

const executorEnvironment = makeEnvironment({ throwOnExecute: 2 });
const executorFailure = Harness.executeApproved(Harness.approve(twoStepRun()), executorEnvironment.hooks);
assert.equal(executorEnvironment.ledger.length, 0);
assert.equal(executorEnvironment.counts().compensate, 1, "only writes that actually happened are compensated");
assert.equal(executorFailure.run.steps[0].status, "rolled-back");
assert.equal(executorFailure.run.steps[1].status, "failed");

const rollbackEnvironment = makeEnvironment({ failAudit: 2, failCompensation: 1 });
const rollbackFailure = Harness.executeApproved(Harness.approve(twoStepRun()), rollbackEnvironment.hooks);
assert.equal(rollbackFailure.run.transaction.state, "rollback-failed");
assert.equal(rollbackFailure.run.failure.code, "ROLLBACK_FAILED");
assert.ok(rollbackFailure.run.steps.some(step => step.status === "rollback-failed"));

for (const scenario of [
  { option: "noEvidence", code: "EVIDENCE_MISSING" },
  { option: "invalidEvidence", code: "EVIDENCE_MISSING" },
  { option: "dirtyAudit", code: "AUDIT_INTEGRITY" },
  { option: "staleEvidence", code: "EVIDENCE_TIME" },
]) {
  const environment = makeEnvironment({ [scenario.option]: 1 });
  const result = Harness.executeApproved(Harness.approve(Harness.createRun({ actions: [{ type: "add_task", title: scenario.option }] })), environment.hooks);
  assert.equal(result.run.status, "failed");
  assert.equal(result.run.failure.code, scenario.code);
  assert.equal(environment.ledger.length, 0, `${scenario.option} must roll back`);
}

const certificateTamper = clone(success.run);
certificateTamper.terminationCertificate.coverage.verified = 1;
assert.equal(Harness.verifyCertificate(certificateTamper).valid, false, "certificate edits are detected");
const evidenceTamper = clone(success.run);
evidenceTamper.taskState.evidenceLedger[0].evidence[0].claim = "fabricated";
assert.equal(Harness.verifyCertificate(evidenceTamper).valid, false, "evidence edits are detected");
const auditTamper = clone(success.run);
auditTamper.steps[0].audit.evidence[0].claim = "different from the certified ledger";
assert.equal(Harness.verifyCertificate(auditTamper).valid, false, "step audit and certified evidence must agree");

const retryEnvironment = makeEnvironment({ failAudit: 1 });
const firstAttempt = Harness.executeApproved(Harness.approve(Harness.createRun({ actions: [{ type: "add_task", title: "Retry safely" }] })), retryEnvironment.hooks);
assert.equal(firstAttempt.run.transaction.state, "rolled-back");
let retryRun = Harness.retry(firstAttempt.run);
assert.equal(retryRun.status, "awaiting-approval");
assert.equal(retryRun.approval, null, "recovery requires a new user decision");
const retryBlocked = Harness.executeApproved(retryRun, makeEnvironment().hooks);
assert.equal(retryBlocked.applied, 0);
retryRun = Harness.approve(retryRun);
const recovered = Harness.executeApproved(retryRun, makeEnvironment().hooks);
assert.equal(recovered.run.status, "completed");
assert.equal(recovered.run.steps[0].attempts, 2);
assert.equal(Harness.verifyCertificate(recovered.run).valid, true);

const cancelled = Harness.cancel(twoStepRun());
assert.equal(cancelled.status, "cancelled");
assert.ok(cancelled.steps.every(step => step.status === "cancelled"));
const bounded = Harness.createRun({ actions: Array.from({ length: 20 }, (_, index) => ({ type: "add_task", title: String(index) })) });
assert.equal(bounded.steps.length, Harness.MAX_STEPS, "runs enforce a hard step budget");

console.log("Aero Harness v0.4 adversarial checks passed (39 assertion groups)");
