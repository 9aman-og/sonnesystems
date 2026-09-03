"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..", "..");
global.window = {};

function load(relative) {
  vm.runInThisContext(fs.readFileSync(path.join(root, relative), "utf8"), { filename: relative });
}

load("app/aero-harness.js");
load("app-next/core/attention.js");

const Attention = window.AeroAttention;
assert.ok(Attention, "attention governor should load");

const AT = new Date(2026, 8, 3, 12, 0, 0, 0).getTime();
const HOUR = 60 * 60 * 1000;

function candidate(overrides = {}) {
  return {
    category: "today",
    urgency: "urgent",
    title: "One loop is due today",
    detail: "Prepare the release",
    sourceType: "task",
    sourceRef: "task-1",
    occurrenceKey: "2026-09-03",
    expiresAt: AT + 24 * HOUR,
    ...overrides,
  };
}

const derived = Attention.deriveCandidates({
  tasks: [
    { id: "late-high", title: "Fix production", due: "2026-09-02", priority: "High", status: "open" },
    { id: "late-low", title: "Clean notes", due: "2026-09-01", priority: "Low", status: "open" },
    { id: "today", title: "Review launch", due: "2026-09-03", priority: "Medium", status: "open" },
    { id: "tomorrow", title: "Send brief", due: "2026-09-04", priority: "High", status: "open" },
    { id: "done", title: "Already done", due: "2026-09-01", priority: "High", status: "done" },
  ],
  aeroRuns: [],
}, AT);
assert.equal(derived.length, 3, "structured task facts should be grouped into three quiet candidates");
assert.equal(derived.find(item => item.category === "overdue").urgency, "critical");
assert.match(derived.find(item => item.category === "overdue").detail, /\+ 1 more/);
assert.equal(derived.some(item => /Already done/.test(item.detail)), false);

let result = Attention.refresh(null, [candidate()], { mode: "brief" }, AT);
assert.ok(result.interrupt, "the first urgent structured fact may interrupt");
assert.equal(result.state.proactiveCount, 1);
assert.equal(result.state.notifications.length, 1);

const duplicate = Attention.refresh(result.state, [candidate()], { mode: "brief" }, AT + 1);
assert.equal(duplicate.interrupt, null, "the same occurrence cannot interrupt twice");
assert.equal(duplicate.added.length, 0, "the update feed is deduplicated too");

const secondUrgent = Attention.refresh(result.state, [candidate({ category: "execution", sourceType: "run", sourceRef: "run-1", occurrenceKey: "run-1" })], { mode: "brief" }, AT + 2 * HOUR);
assert.equal(secondUrgent.interrupt, null, "a second same-day interruption must be critical");
assert.equal(secondUrgent.state.proactiveCount, 1);

const secondCritical = Attention.refresh(result.state, [candidate({ category: "execution", urgency: "critical", title: "A change needs recovery", sourceType: "run", sourceRef: "run-2", occurrenceKey: "run-2" })], { mode: "brief" }, AT + 2 * HOUR);
assert.ok(secondCritical.interrupt, "one distinct critical condition may use the second slot");
assert.equal(secondCritical.state.proactiveCount, 2);

const thirdCritical = Attention.refresh(secondCritical.state, [candidate({ category: "system", urgency: "critical", title: "Account protection changed", sourceType: "system", sourceRef: "security-1", occurrenceKey: "security-1" })], { mode: "brief" }, AT + 4 * HOUR);
assert.equal(thirdCritical.interrupt, null, "the daily proactive budget is a hard cap of two");
assert.equal(thirdCritical.state.notifications.length, 3, "suppressed interruptions still reach the quiet feed");

const tooSoon = Attention.refresh(result.state, [candidate({ category: "execution", urgency: "critical", title: "A change needs recovery", sourceType: "run", sourceRef: "run-fast", occurrenceKey: "run-fast" })], { mode: "brief" }, AT + 30 * 60 * 1000);
assert.equal(tooSoon.interrupt, null, "the second interruption cannot arrive within an hour");

const quiet = Attention.refresh(null, [candidate()], { mode: "brief", quietHours: { start: 11, end: 13 } }, AT);
assert.equal(quiet.interrupt, null, "quiet hours move an urgent fact to the feed");
assert.equal(quiet.state.notifications.length, 1);

const focused = Attention.refresh(null, [candidate()], { mode: "brief", focused: true, quietHours: { start: 22, end: 8 } }, AT);
assert.equal(focused.interrupt, null, "active focus suppresses interruption");

const modelClaim = Attention.refresh(null, [candidate({ sourceType: "model", sourceRef: "model-claim", urgency: "critical" })], { mode: "brief" }, AT);
assert.equal(modelClaim.interrupt, null, "model output cannot grant itself interruption authority");
assert.equal(modelClaim.state.notifications.length, 1, "untrusted signals may remain inspectable in the feed");

const off = Attention.refresh(null, [candidate()], { mode: "off" }, AT);
assert.equal(off.interrupt, null, "off means no proactive conversation messages");

let learned = Attention.refresh(null, [candidate()], { mode: "brief", focused: true }, AT).state;
const firstNoteId = learned.notifications[0].id;
learned = Attention.feedback(learned, firstNoteId, "dismissed", AT + 1);
learned = Attention.feedback(learned, firstNoteId, "dismissed", AT + 2);
assert.equal(learned.feedback.today.dismissed, 1, "feedback is idempotent per notification and outcome");
learned = Attention.refresh(learned, [candidate({ sourceRef: "task-2", occurrenceKey: "2026-09-04" })], { mode: "brief", focused: true }, AT + 3).state;
const secondNoteId = learned.notifications.find(item => item.sourceRef === "task-2").id;
learned = Attention.feedback(learned, secondNoteId, "dismissed", AT + 4);
const learnedSilence = Attention.refresh(learned, [candidate({ sourceRef: "task-3", occurrenceKey: "2026-09-05" })], { mode: "brief" }, AT + 5);
assert.equal(learnedSilence.interrupt, null, "repeated dismissal teaches silence for non-critical updates");
assert.equal(learnedSilence.state.telemetry.at(-1).reason, "learned-silence");

const nextDay = Attention.refresh(secondCritical.state, [candidate({ sourceRef: "task-next", occurrenceKey: "2026-09-04", expiresAt: AT + 48 * HOUR })], { mode: "brief" }, AT + 24 * HOUR);
assert.equal(nextDay.state.proactiveCount, 1, "the daily budget resets on the next local day");

const marked = Attention.markAllRead(thirdCritical.state, AT + 5 * HOUR);
assert.equal(Attention.summary(marked, AT + 5 * HOUR).unread, 0);

const telemetryText = JSON.stringify(thirdCritical.state.telemetry);
assert.equal(telemetryText.includes("Prepare the release"), false, "telemetry must not copy private notification text");
assert.equal(telemetryText.includes("title"), false, "telemetry stays metadata-only");

console.log("Aero attention governor v0.1 checks passed (budget, trust, timing, feedback, privacy)");
