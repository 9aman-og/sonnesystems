import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(directory, "app.js"), "utf8");
const cloud = fs.readFileSync(path.join(directory, "cloud.js"), "utf8");

test("signed-in memory has a dedicated private Edge route", () => {
  assert.match(cloud, /\/functions\/v1\/aero-memory/);
  assert.match(cloud, /async readAeroMemory\(\)/);
  assert.match(cloud, /async prepareAeroMemory\(payload\)/);
  assert.match(cloud, /async commitAeroMemory\(payload\)/);
  assert.match(cloud, /async observeAeroMemory\(payload\)/);
  assert.match(cloud, /async cancelAeroMemory\(payload\)/);
});

test("memory operations are not smuggled through the Lyfe record executor", () => {
  const recordSet = app.match(/const AERO_SERVER_ACTIONS = new Set\(\[[\s\S]*?\]\);/i)?.[0] || "";
  assert.doesNotMatch(recordSet, /memory_upsert|memory_forget/);
  assert.match(app, /const AERO_MEMORY_ACTIONS = new Set\(\["memory_upsert", "memory_forget"\]\)/);
  assert.match(app, /return "mixed"/);
  assert.match(app, /Memory and workspace records use separate private ledgers/);
  assert.match(app, /aeroServerKind\(message\.proposal\.actions\) === "mixed"[\s\S]*?aeroReviewProposalModal\(message\)/);
});

test("the account ledger is read on boot and after remote Lyfe changes", () => {
  assert.match(app, /async function refreshAuthoritativeAeroMemory/);
  assert.match(app, /await LyfeCloud\.readAeroMemory\(\)/);
  assert.match(app, /await refreshAuthoritativeAeroMemory\(false\)/);
  assert.match(app, /function onCloudRemote[\s\S]*?refreshAuthoritativeAeroMemory\(!typing\)/);
  assert.match(app, /const quarantined = AeroCore\.freshState\(\)[\s\S]*?state\.data\.aero = quarantined/);
  assert.match(app, /pendingEpisodes\.filter\(episode => !authoritativeEpisodeIds\.has\(episode\.id\)\)/);
  assert.match(app, /authoritative\.memoryRevision < cached\.memoryRevision/);
  assert.match(app, /private memory paused/);
});

test("the Edge route binds and verifies the canonical state digest", () => {
  const edge = fs.readFileSync(path.join(directory, "..", "supabase", "functions", "aero-memory", "index.ts"), "utf8");
  assert.match(edge, /aero_bind_memory_canonical_digest/);
  assert.match(edge, /canonicalDigestBound/);
  assert.match(edge, /digestValue\(state\)/);
  assert.match(edge, /digestValue\(normalizeState\(result\.state\)\)/);
});

test("explicit memory review commits one exact private transaction", () => {
  assert.match(app, /LyfeCloud\.prepareAeroMemory\([\s\S]*?operations: aeroMemoryOperations/);
  assert.match(app, /step\.type === "memory_upsert" \? aeroActionDetail\(\{ type: step\.type, claim: step\.subject \}\)/);
  assert.match(app, /step\.type === "memory_forget" \? aeroActionDetail\(\{ type: step\.type, query: step\.subject \}\)/);
  assert.match(app, /approvalToken: prepared\.approvalToken/);
  assert.match(app, /LyfeCloud\.commitAeroMemory\([\s\S]*?transactionId: binding\.transactionId[\s\S]*?approvalToken: binding\.approvalToken/);
  assert.match(app, /state\.data\.aero = AeroCore\.normalize\(result\.state\)/);
});

test("feedback is lower-authority observation evidence on the private ledger", () => {
  assert.match(app, /function observeAeroOutcome/);
  assert.match(app, /LyfeCloud\.observeAeroMemory\(\{[\s\S]*?type: "observe", episode: evidenceEpisode, outcome/);
  assert.match(app, /if \(!serverOwned\) \{[\s\S]*?AeroCore\.observeOutcome/);
  assert.match(app, /Signed-in feedback is evidence for the private ledger/);
  assert.doesNotMatch(app, /observeAeroMemory\([\s\S]*?type: "remember"/);
});

test("privacy controls use the server for signed-in forget and reset", () => {
  assert.match(app, /case "aero-forget"[\s\S]*?commitDirectAeroMemory\([\s\S]*?type: "forget"/);
  assert.match(app, /case "aero-reset"[\s\S]*?commitDirectAeroMemory\([\s\S]*?type: "reset"/);
});
