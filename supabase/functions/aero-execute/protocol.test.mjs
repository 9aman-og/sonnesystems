import assert from "node:assert/strict";
import test from "node:test";

import {
  ProtocolError,
  digestValue,
  hashToken,
  normalizeActions,
  prepareRunMaterial,
  randomToken,
} from "./protocol.mjs";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const AT = Date.parse("2026-08-29T10:00:00.000Z");

function state(overrides = {}) {
  return {
    rev: 7,
    savedAt: AT - 1,
    settings: { name: "Aman", apiKey: "" },
    tasks: [],
    projects: [],
    goals: [],
    education: [],
    worklog: [],
    notes: [],
    docs: [],
    saved: [{ id: "saved-1", title: "Preserve me" }],
    chat: [{ id: "chat-1", role: "user", text: "Private and preserved" }],
    ...overrides,
  };
}

async function prepare(actions, overrides = {}) {
  return prepareRunMaterial({
    userId: USER_ID,
    requestKey: "request-fixed-0001",
    runId: RUN_ID,
    intent: "Prepare bounded Lyfe changes",
    actions,
    state: state(),
    rev: 7,
    ...overrides,
  });
}

test("canonical SHA-256 is stable across object key order", async () => {
  assert.equal(await digestValue({ b: 2, a: { d: 4, c: 3 } }), await digestValue({ a: { c: 3, d: 4 }, b: 2 }));
});

test("one contract materializes every supported Lyfe record action", async () => {
  const actions = [
    { type: "add_task", title: "Launch", priority: "High", area: "Work", due: "2026-09-01" },
    { type: "add_note", title: "Direction", body: "Keep this private" },
    { type: "add_doc", title: "Spec", body: "Atomic path" },
    { type: "log_work", text: "Aero boundary", hours: 2.5 },
    { type: "add_goal", title: "Ship v0", why: "Prove the loop" },
    { type: "add_education", title: "Postgres isolation", kind: "Paper" },
    { type: "add_project", name: "Aero boundary", area: "Research" },
  ];
  const result = await prepare(actions);
  assert.equal(result.review.length, 7);
  assert.equal(result.patches.length, 7);
  assert.equal(result.targetData.rev, 8);
  assert.equal(result.targetData.savedAt, AT);
  assert.equal(result.targetData.tasks[0].title, "Launch");
  assert.equal(result.targetData.notes[0].body, "Keep this private");
  assert.equal(result.targetData.docs[0].title, "Spec");
  assert.equal(result.targetData.worklog[0].hours, 2.5);
  assert.equal(result.targetData.goals[0].status, "active");
  assert.equal(result.targetData.education[0].kind, "Paper");
  assert.equal(result.targetData.projects[0].name, "Aero boundary");
  assert.deepEqual(result.targetData.saved, state().saved);
  assert.deepEqual(result.targetData.chat, state().chat);
  assert.equal(result.contract.rollbackPolicy, "database-transaction");
  assert.equal(result.contract.route, "supabase-atomic-state-engine");
  assert.equal(result.contract.budget.maxExternalWrites, 1);
  assert.deepEqual(result.contract.target, { nextRev: 8, digest: result.targetDigest });
  assert.equal(await digestValue(result.targetData), result.contract.target.digest);
});

test("completion binds to exactly one open task", async () => {
  const source = state({ tasks: [{ id: "task-1", title: "Submit fellowship", status: "open" }] });
  const result = await prepare(
    [{ type: "complete_task", title: "Submit fellowship" }],
    { state: source },
  );
  assert.equal(result.targetData.tasks[0].status, "done");
  assert.equal(result.targetData.tasks[0].completedAt, AT);
  assert.equal(result.patches[0].op, "replace");

  await assert.rejects(
    () => prepare([{ type: "complete_task", title: "Launch" }], {
      state: state({ tasks: [
        { id: "a", title: "Launch site", status: "open" },
        { id: "b", title: "Launch post", status: "open" },
      ] }),
    }),
    (error) => error instanceof ProtocolError && error.code === "TARGET_NOT_SINGULAR",
  );
});

test("closed schema rejects memory, external effects, smuggled fields, and malformed values", () => {
  const denied = [
    [{ type: "memory_upsert", claim: "private" }, "CAPABILITY_DENIED"],
    [{ type: "send_email", title: "Send it" }, "CAPABILITY_DENIED"],
    [{ type: "add_task", title: "Safe", shell: "calc.exe" }, "ACTION_UNKNOWN_FIELD"],
    [{ type: "log_work", text: "Bad", hours: 25 }, "ACTION_HOURS_RANGE"],
    [{ type: "add_task", title: "Bad date", due: "tomorrow" }, "ACTION_DATE_FORMAT"],
    [{ type: "add_project", name: "Bad area", area: "Internet" }, "ACTION_AREA"],
  ];
  for (const [action, code] of denied) {
    assert.throws(() => normalizeActions([action]), (error) => error.code === code);
  }
});

test("state validation rejects duplicate IDs and non-list collections", async () => {
  await assert.rejects(
    () => prepare([{ type: "add_task", title: "Safe" }], {
      state: state({ tasks: [{ id: "same" }, { id: "same" }] }),
    }),
    (error) => error.code === "STATE_INVALID",
  );
  await assert.rejects(
    () => prepare([{ type: "add_task", title: "Safe" }], { state: state({ notes: {} }) }),
    (error) => error.code === "STATE_INVALID",
  );
});

test("contract binds the account, request, revision, exact before state, and exact target", async () => {
  const first = await prepare([{ type: "add_task", title: "Bound" }]);
  const same = await prepare([{ type: "add_task", title: "Bound" }]);
  assert.equal(first.contractDigest, same.contractDigest);
  assert.equal(first.targetDigest, same.targetDigest);
  assert.equal(first.contract.target.digest, first.targetDigest);
  const alteredTarget = structuredClone(first.targetData);
  alteredTarget.tasks[0].title = "Changed after review";
  assert.notEqual(await digestValue(alteredTarget), first.contract.target.digest);

  const changedAccount = await prepare([{ type: "add_task", title: "Bound" }], {
    userId: "33333333-3333-4333-8333-333333333333",
  });
  const changedRequest = await prepare([{ type: "add_task", title: "Bound" }], {
    requestKey: "request-fixed-0002",
  });
  const changedState = await prepare([{ type: "add_task", title: "Bound" }], {
    state: state({ notes: [{ id: "n1", title: "Changed" }] }),
  });
  assert.notEqual(first.contractDigest, changedAccount.contractDigest);
  assert.notEqual(first.contractDigest, changedRequest.contractDigest);
  assert.notEqual(first.contractDigest, changedState.contractDigest);
});

test("materialization is deterministic across Edge Function clock drift", async () => {
  const first = await prepare([{ type: "add_task", title: "Retry safe" }], { atMs: AT });
  const retry = await prepare([{ type: "add_task", title: "Retry safe" }], { atMs: AT + 60_000 });
  assert.equal(first.contractDigest, retry.contractDigest);
  assert.equal(first.targetDigest, retry.targetDigest);
  assert.deepEqual(first.targetData, retry.targetData);
});

test("a server run requires the synced base document's logical timestamp", async () => {
  await assert.rejects(
    () => prepare([{ type: "add_task", title: "Safe" }], { state: state({ savedAt: null }) }),
    (error) => error.code === "STATE_SAVED_AT",
  );
});

test("record IDs are deterministic for retries but separated between requests", async () => {
  const first = await prepare([{ type: "add_task", title: "Retry safe" }]);
  const retry = await prepare([{ type: "add_task", title: "Retry safe" }]);
  const other = await prepare([{ type: "add_task", title: "Retry safe" }], {
    requestKey: "request-fixed-0002",
  });
  assert.equal(first.targetData.tasks[0].id, retry.targetData.tasks[0].id);
  assert.notEqual(first.targetData.tasks[0].id, other.targetData.tasks[0].id);
});

test("approval tokens are high-entropy values and only their hash is stable", async () => {
  const left = randomToken();
  const right = randomToken();
  assert.ok(left.length >= 40);
  assert.notEqual(left, right);
  assert.equal(await hashToken(left), await hashToken(left));
  assert.notEqual(await hashToken(left), await hashToken(right));
});

test("mixed adversarial mutations cannot widen the capability set", () => {
  const types = ["send_email", "delete_account", "run_shell", "memory_upsert", "browse", "publish"];
  for (let index = 0; index < 240; index += 1) {
    const type = types[index % types.length];
    assert.throws(
      () => normalizeActions([{ type, title: `mutation-${index}` }]),
      (error) => error.code === "CAPABILITY_DENIED",
    );
  }
});
