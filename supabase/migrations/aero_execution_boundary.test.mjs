import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const migrationName = fs.readdirSync(directory).find((name) => /_aero_execution_boundary\.sql$/.test(name));
assert.ok(migrationName, "Aero execution migration is missing");
const sql = fs.readFileSync(path.join(directory, migrationName), "utf8");

function functionBody(name) {
  const pattern = new RegExp(`create or replace function ${name.replaceAll(".", "\\.")}\\([\\s\\S]*?\\n\\$\\$;`, "i");
  const match = sql.match(pattern);
  assert.ok(match, `${name} is missing`);
  return match[0];
}

test("run data stays in an Aero-specific non-exposed schema", () => {
  assert.match(sql, /create schema if not exists aero_private;/i);
  assert.match(sql, /revoke all on schema aero_private from public, anon, authenticated;/i);
  assert.doesNotMatch(sql, /create table(?: if not exists)? public\.aero_runs/i);
  assert.match(sql, /alter table aero_private\.aero_runs force row level security;/i);
  assert.match(sql, /alter table aero_private\.aero_run_events force row level security;/i);
  assert.doesNotMatch(sql, /grant [^;]*aero_(?:runs|run_events)[^;]* to (?:anon|authenticated)/i);
});

test("consumer roles lose RLS-bypassing table privileges", () => {
  assert.match(sql, /revoke\s+truncate,\s*trigger,\s*references\s+on\s+table[\s\S]*?public\.lyfe_states[\s\S]*?public\.connect_notifications[\s\S]*?from\s+public,\s*anon,\s*authenticated\s*;/i);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.lyfe_enforce_state_revision\(\)\s+from\s+public,\s*anon,\s*authenticated\s*;/i);
});

test("authority is hashed and public callers cannot mutate the journal", () => {
  assert.match(sql, /approval_token_hash\s+text/i);
  assert.doesNotMatch(sql, /\bapproval_token\s+text/i);
  for (const name of ["aero_prepare_run", "aero_commit_run", "aero_cancel_run", "aero_inspect_run", "aero_forget_run"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([\\s\\S]*?from public, anon, authenticated;`, "i"));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\([\\s\\S]*?to service_role;`, "i"));
  }
});

test("ordinary Lyfe writes are strict one-revision compare-and-swap", () => {
  const guard = functionBody("public.lyfe_enforce_state_revision");
  const cas = functionBody("public.lyfe_compare_and_swap_state");
  assert.match(guard, /new\.rev <> old\.rev \+ 1/i);
  assert.match(guard, /#- '\{settings,apiKey\}'/i);
  assert.match(cas, /security definer[\s\S]*?set search_path = ''/i);
  assert.match(cas, /v_user uuid := auth\.uid\(\)/i);
  assert.match(cas, /where user_id = v_user[\s\S]*?for update/i);
  assert.match(cas, /v_row\.rev <> p_expected_rev/i);
  assert.match(sql, /grant execute on function public\.lyfe_compare_and_swap_state\(bigint, jsonb\) to authenticated;/i);
});

test("commit locks state, rejects drift and consumes approval in one transaction", () => {
  const commit = functionBody("public.aero_commit_run");
  assert.match(commit, /from aero_private\.aero_runs[\s\S]*?for update/i);
  assert.match(commit, /aero_event_chain_valid/i);
  assert.match(commit, /aero_payload_storage_digest/i);
  assert.match(commit, /v_run\.approval_token_hash <> p_approval_token_hash/i);
  assert.match(commit, /from public\.lyfe_states[\s\S]*?for update/i);
  assert.match(commit, /v_state\.rev <> v_run\.base_rev/i);
  assert.match(commit, /set data = v_run\.target_data, rev = v_run\.base_rev \+ 1/i);
  assert.match(commit, /set status = 'completed', approval_token_hash = null/i);
  assert.match(commit, /'atomic', true/i);
  assert.doesNotMatch(commit, /commit;|rollback;/i);
});

test("the evidence chain is recomputed before sensitive transitions", () => {
  const verify = functionBody("aero_private.aero_event_chain_valid");
  assert.match(verify, /order by sequence/i);
  assert.match(verify, /v_event\.previous_digest <> v_previous/i);
  assert.match(verify, /v_event\.event_digest <> v_digest/i);
  assert.match(verify, /event_sequence, event_head_digest/i);
});
