import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const migrationName = fs.readdirSync(directory).find((name) => /_aero_server_owned_memory\.sql$/.test(name));
assert.ok(migrationName, "Aero server-owned memory migration is missing");
const sql = fs.readFileSync(path.join(directory, migrationName), "utf8");
const bindingName = fs.readdirSync(directory).find((name) => /_aero_memory_canonical_digest_binding\.sql$/.test(name));
assert.ok(bindingName, "Aero canonical digest binding migration is missing");
const bindingSql = fs.readFileSync(path.join(directory, bindingName), "utf8");
const concurrencySql = fs.readFileSync(path.join(directory, "..", "tests", "aero_memory_concurrency_rollback.sql"), "utf8");

function functionBody(name) {
  const pattern = new RegExp(`create or replace function ${name.replaceAll(".", "\\.")}\\([\\s\\S]*?\\n\\$\\$;`, "i");
  const match = sql.match(pattern);
  assert.ok(match, `${name} is missing`);
  return match[0];
}

test("typed memory and transaction data stay in a private forced-RLS schema", () => {
  for (const table of ["aero_memory_accounts", "aero_memories", "aero_memory_edges", "aero_memory_transactions", "aero_memory_events"]) {
    assert.match(sql, new RegExp(`create table if not exists aero_private\\.${table}`, "i"));
    assert.match(sql, new RegExp(`alter table aero_private\\.${table} force row level security`, "i"));
    assert.doesNotMatch(sql, new RegExp(`create table(?: if not exists)? public\\.${table}`, "i"));
  }
  assert.match(sql, /revoke all on schema aero_private from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /grant [^;]*aero_memory_(?:accounts|transactions|events)[^;]* to (?:anon|authenticated)/i);
});

test("browser roles cannot call service-owned memory RPCs", () => {
  for (const name of ["read_memory_state", "prepare_memory_transaction", "commit_memory_transaction", "cancel_memory_transaction", "inspect_memory_transaction", "forget_memory_transaction"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.aero_${name}\\([\\s\\S]*?from public, anon, authenticated;`, "i"));
    assert.match(sql, new RegExp(`grant execute on function public\\.aero_${name}\\([\\s\\S]*?to service_role;`, "i"));
  }
});

test("authoritative state has an independent storage-integrity digest", () => {
  assert.match(sql, /state_digest\s+text not null/i);
  assert.match(sql, /state_storage_digest\s+text not null/i);
  const read = functionBody("public.aero_read_memory_state");
  assert.match(read, /state_storage_digest <> aero_private\.aero_memory_state_digest\(v_account\.state\)/i);
  assert.match(read, /memory_integrity_failed/i);
});

test("bootstrap state is bound once to the Edge canonical digest", () => {
  assert.match(bindingSql, /canonical_digest_bound boolean not null default false/i);
  assert.match(bindingSql, /aero_bind_memory_canonical_digest/i);
  assert.match(bindingSql, /state_storage_digest <> aero_private\.aero_memory_state_digest\(v_account\.state\)/i);
  assert.match(bindingSql, /v_account\.revision <> p_revision/i);
  assert.match(bindingSql, /v_account\.state_digest <> p_canonical_digest/i);
  assert.match(bindingSql, /revoke all on function public\.aero_bind_memory_canonical_digest[\s\S]*from public, anon, authenticated/i);
  assert.match(bindingSql, /grant execute on function public\.aero_bind_memory_canonical_digest[\s\S]*to service_role/i);
});

test("projection enforces typed slots, provenance authority, and dependency edges", () => {
  assert.match(sql, /memory_type in \('episodic', 'semantic', 'project', 'procedural'\)/i);
  assert.match(sql, /authority in \('user', 'behavior'\)/i);
  assert.match(sql, /where status in \('active', 'provisional'\)/i);
  const project = functionBody("aero_private.aero_project_memory_state");
  assert.match(project, /delete from aero_private\.aero_memory_edges[\s\S]*?delete from aero_private\.aero_memories/i);
  assert.match(project, /insert into aero_private\.aero_memories/i);
  assert.match(project, /insert into aero_private\.aero_memory_edges/i);
});

test("prepare binds identity, closed operations, exact base, exact target, and one-use approval", () => {
  const prepare = functionBody("public.aero_prepare_memory_transaction");
  assert.match(prepare, /p_contract->'operations' is distinct from p_operation/i);
  assert.match(prepare, /\{state,baseRevision\}/i);
  assert.match(prepare, /\{state,beforeDigest\}/i);
  assert.match(prepare, /\{target,digest\}/i);
  assert.match(prepare, /approval_token_hash/i);
  assert.doesNotMatch(prepare, /\bapproval_token\b(?!_hash)/i);
  assert.match(prepare, /memory_state_changed/i);
  assert.match(prepare, /memory_idempotency_conflict/i);
});

test("commit locks transaction then state, rejects drift, and atomically projects one revision", () => {
  const commit = functionBody("public.aero_commit_memory_transaction");
  assert.match(commit, /from aero_private\.aero_memory_transactions[\s\S]*?for update/i);
  assert.match(commit, /aero_memory_event_chain_valid/i);
  assert.match(commit, /approval_token_hash <> p_approval_token_hash/i);
  assert.match(commit, /from aero_private\.aero_memory_accounts[\s\S]*?for update/i);
  assert.match(commit, /v_account\.revision <> v_transaction\.base_revision/i);
  assert.match(commit, /revision = v_transaction\.base_revision \+ 1/i);
  assert.match(commit, /aero_project_memory_state\(p_user_id, v_state\)/i);
  assert.match(commit, /set status = 'completed', approval_token_hash = null/i);
  assert.match(commit, /'atomic', true/i);
  assert.doesNotMatch(commit, /update public\.lyfe_states/i);
  assert.doesNotMatch(commit, /commit;|rollback;/i);
});

test("terminal transitions redact claims and raw target states", () => {
  const redact = functionBody("aero_private.aero_redact_memory_transaction");
  assert.match(redact, /operation = '\[\]'::jsonb/i);
  assert.match(redact, /target_state = '\{\}'::jsonb/i);
  assert.match(redact, /aero_minimal_memory_review/i);
  for (const name of ["public.aero_commit_memory_transaction", "public.aero_cancel_memory_transaction"]) {
    assert.match(functionBody(name), /aero_redact_memory_transaction/i);
  }
  assert.match(functionBody("aero_private.aero_expire_memory_transactions"), /aero_redact_memory_transaction/i);
});

test("the evidence chain is recomputed before sensitive transitions", () => {
  const verify = functionBody("aero_private.aero_memory_event_chain_valid");
  assert.match(verify, /order by sequence/i);
  assert.match(verify, /v_event\.previous_digest <> v_previous/i);
  assert.match(verify, /v_event\.event_digest <> v_digest/i);
  assert.match(verify, /event_sequence, event_head_digest/i);
});

test("the production concurrency smoke is rollback-only and checks crash recovery", () => {
  assert.match(concurrencySql, /^begin;/im);
  assert.match(concurrencySql, /select result from aero_memory_concurrency_result;[\s\S]*rollback;/i);
  assert.match(concurrencySql, /memory_state_changed/i);
  assert.match(concurrencySql, /memory_approval_replayed/i);
  assert.match(concurrencySql, /idempotent/i);
  assert.match(concurrencySql, /memory_approval_invalid/i);
  assert.match(concurrencySql, /journalValid/i);
  assert.match(concurrencySql, /payloadValid/i);
});
