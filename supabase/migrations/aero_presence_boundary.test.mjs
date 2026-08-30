import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationName = fs.readdirSync(here).find((name) => /_aero_transaction_bound_presence\.sql$/.test(name));
assert.ok(migrationName, "transaction-bound presence migration is required");
const sql = fs.readFileSync(path.join(here, migrationName), "utf8");
const hardeningName = fs.readdirSync(here).find((name) => /_harden_aero_presence_text_validation\.sql$/.test(name));
assert.ok(hardeningName, "presence text-validation hardening migration is required");
const hardeningSql = fs.readFileSync(path.join(here, hardeningName), "utf8");
const revocationName = fs.readdirSync(here).find((name) => /_preserve_aero_presence_audit_on_revoke\.sql$/.test(name));
assert.ok(revocationName, "presence audit-preserving revocation migration is required");
const revocationSql = fs.readFileSync(path.join(here, revocationName), "utf8");
const root = path.resolve(here, "../..");
const edge = fs.readFileSync(path.join(root, "supabase/functions/aero-presence/index.ts"), "utf8");
const protocol = fs.readFileSync(path.join(root, "supabase/functions/aero-presence/protocol.mjs"), "utf8");
const execute = fs.readFileSync(path.join(root, "supabase/functions/aero-execute/index.ts"), "utf8");
const memory = fs.readFileSync(path.join(root, "supabase/functions/aero-memory/index.ts"), "utf8");
const cloud = fs.readFileSync(path.join(root, "lyfe/cloud.js"), "utf8");
const app = fs.readFileSync(path.join(root, "lyfe/app.js"), "utf8");
const rollbackSmoke = fs.readFileSync(path.join(root, "supabase/tests/aero_presence_atomic_rollback.sql"), "utf8");

function body(name) {
  const match = sql.match(new RegExp(`create or replace function (?:public|aero_private)\\.${name}\\([\\s\\S]*?\\n\\$\\$;`, "i"));
  assert.ok(match, `${name} must exist`);
  return match[0];
}

test("credentials, challenges, and grants are private forced-RLS records", () => {
  for (const table of ["aero_presence_credentials", "aero_presence_challenges", "aero_presence_grants"]) {
    assert.match(sql, new RegExp(`create table if not exists aero_private\\.${table}`, "i"));
    assert.match(sql, new RegExp(`alter table aero_private\\.${table} force row level security`, "i"));
    assert.match(sql, new RegExp(`revoke all on table aero_private\\.${table} from public, anon, authenticated`, "i"));
  }
  assert.doesNotMatch(sql, /grant (?:select|insert|update|delete|all) on table aero_private\.aero_presence_[a-z_]+ to (?:anon|authenticated)/i);
});

test("base64url protocol limits avoid unsupported PostgreSQL repetition counts", () => {
  assert.doesNotMatch(`${sql}\n${hardeningSql}\n${revocationSql}`, /\{\d+,(?:25[6-9]|2[6-9]\d|[3-9]\d{2,}|\d{4,})\}/);
  assert.match(sql, /char_length\(credential_id\) between 16 and 1024/i);
  assert.match(sql, /char_length\(public_key\) between 16 and 4096/i);
  assert.match(sql, /char_length\(challenge\) between 32 and 256/i);
  assert.match(hardeningSql, /drop constraint if exists aero_presence_credential_id_format/i);
  assert.match(hardeningSql, /aero_presence_grants_credential_idx[\s\S]*\(credential_id\)/i);
  assert.match(hardeningSql, /create or replace function public\.aero_prepare_presence_challenge/i);
  assert.match(hardeningSql, /create or replace function public\.aero_complete_presence_registration/i);
});

test("verified removal revokes future use without deleting approval evidence", () => {
  assert.match(sql, /revoked_at\s+timestamptz/i);
  assert.match(sql, /aero_presence_credentials_one_active_user_idx[\s\S]*where revoked_at is null/i);
  assert.match(sql, /set revoked_at = now\(\), last_used_at = now\(\)/i);
  assert.doesNotMatch(body("aero_complete_presence_assertion"), /delete from aero_private\.aero_presence_credentials/i);
  assert.match(revocationSql, /drop constraint if exists aero_presence_credentials_user_id_key/i);
  assert.match(revocationSql, /where credential_id = p_credential_id and user_id = p_user_id[\s\S]*revoked_at is null for update/i);
  assert.match(rollbackSmoke, /presence audit evidence was erased on revocation/i);
});

test("the server binds one challenge to the current exact target and approval hash", () => {
  const prepare = body("aero_prepare_presence_challenge");
  assert.match(prepare, /v_run\.contract_digest <> p_contract_digest[\s\S]*v_run\.approval_token_hash <> p_approval_token_hash/i);
  assert.match(prepare, /v_memory\.contract_digest <> p_contract_digest[\s\S]*v_memory\.approval_token_hash <> p_approval_token_hash/i);
  assert.match(prepare, /status <> 'prepared'/i);
  assert.match(prepare, /approval_expires_at is null or [\s\S]*approval_expires_at <= now\(\)/i);
  assert.match(sql, /approval_token_hash\s+text/i);
  assert.doesNotMatch(sql, /\bapproval_token\s+text/i);
});

test("credential bootstrap is single-device, recent-auth, UV-required, and production-origin scoped", () => {
  const prepare = body("aero_prepare_presence_challenge");
  assert.match(prepare, /p_ceremony = 'registration'[\s\S]*aero_presence_required\(p_user_id\)/i);
  assert.match(edge, /recentInteractiveAuthentication\(token\)/);
  assert.match(protocol, /entry\.method !== "token_refresh"/);
  assert.match(edge, /expectedOrigin:\s*PRODUCTION_ORIGIN/);
  assert.match(edge, /expectedRPID:\s*RP_ID/);
  assert.match(edge, /requireUserVerification:\s*true/g);
  assert.match(edge, /advancedFIDOConfig:\s*\{\s*userVerification:\s*"required"\s*\}/);
  assert.match(edge, /requireProductionOrigin\(origin\)/);
});

test("assertions use custom one-use challenges and only hashed grants persist", () => {
  assert.match(edge, /challenge:\s*randomToken\(\)/g);
  assert.match(edge, /p_challenge:\s*input\.challenge/);
  assert.match(edge, /p_grant_token_hash:\s*presenceToken \? await hashToken\(presenceToken\) : null/);
  assert.doesNotMatch(sql, /\bpresence_token\s+text/i);
  const finish = body("aero_complete_presence_assertion");
  assert.match(finish, /consumed_at is not null[\s\S]*presence_challenge_replayed/i);
  assert.match(finish, /expires_at <= now\(\)[\s\S]*presence_challenge_expired/i);
  assert.match(finish, /v_credential\.counter > 0 and p_new_counter <= v_credential\.counter/i);
});

test("commit locks the exact grant, commits, then consumes it in the same transaction", () => {
  const lock = body("aero_lock_presence_grant");
  assert.match(lock, /token_hash = p_presence_token_hash/);
  assert.match(lock, /target_type = p_target_type and target_id = p_target_id/);
  assert.match(lock, /contract_digest = p_contract_digest/);
  assert.match(lock, /approval_token_hash = p_approval_token_hash/);
  assert.match(lock, /for update/i);
  assert.match(lock, /presence_replayed/i);
  assert.match(lock, /presence_expired/i);

  for (const name of ["aero_commit_run", "aero_commit_memory_transaction"]) {
    const commit = body(name);
    const lockAt = commit.indexOf("aero_lock_presence_grant");
    const coreAt = commit.indexOf(name === "aero_commit_run" ? "aero_commit_run_core" : "aero_commit_memory_transaction_core");
    const consumeAt = commit.indexOf("set consumed_at = now()");
    assert.ok(lockAt >= 0 && coreAt > lockAt && consumeAt > coreAt, `${name} must lock, commit, then consume`);
    assert.match(commit, /presence_verified/i);
    assert.match(commit, /completion_certificate = v_certificate/i);
  }
  assert.match(sql, /set schema aero_private/g);
  assert.match(sql, /revoke all on function public\.aero_commit_run\(uuid, uuid, text, text, text\) from public, anon, authenticated/i);
});

test("behavior-only observations remain automatic but explicit memory changes require presence", () => {
  const commit = body("aero_commit_memory_transaction");
  assert.match(commit, /jsonb_array_elements\(transaction\.operation\)/i);
  assert.match(commit, /operation->>'type' <> 'observe'/i);
  assert.match(memory, /p_presence_token_hash:\s*null/);
  assert.match(memory, /presenceRequired:\s*presence\.data\.enrolled === true/);
});

test("both protected commit gateways pass a presence hash into the new RPC", () => {
  assert.match(execute, /p_presence_token_hash:\s*presenceToken\.length >= 32 \? await hashToken\(presenceToken\) : null/);
  assert.match(memory, /p_presence_token_hash:\s*presenceToken\.length >= 32 \? await hashToken\(presenceToken\) : null/);
  assert.match(execute, /presenceRequired:\s*presence\.data\.enrolled === true/);
});

test("the browser ceremony is native, exact-target bound, and memory-only", () => {
  assert.match(cloud, /navigator\.credentials\.create/);
  assert.match(cloud, /navigator\.credentials\.get/g);
  assert.match(cloud, /registrationJSON\(credential\)/);
  assert.match(cloud, /authenticationJSON\(credential\)/g);
  assert.match(app, /LyfeCloud\.approveAeroPresence\(\{[\s\S]*targetType:[\s\S]*targetId:[\s\S]*contractDigest:[\s\S]*approvalToken:/);
  assert.match(app, /presenceToken,/g);
  assert.match(app, /presenceVerified:/g);
  assert.match(app, /data-action="aero-presence-remove"/);
  assert.match(cloud, /operation !== "status"[\s\S]*PublicKeyCredential/);
  assert.match(cloud, /result\.availableHere = !!\(window\.PublicKeyCredential && navigator\.credentials\)/);
  assert.match(app, /Approval status unavailable[\s\S]*will not assume review-click approval/);
  assert.match(app, /If you lose it, operator-assisted recovery is required/);
  assert.doesNotMatch(cloud, /localStorage[\s\S]{0,120}presenceToken|sessionStorage[\s\S]{0,120}presenceToken/i);
});

test("the production presence smoke is rollback-only and exercises atomic failure paths", () => {
  assert.match(rollbackSmoke, /^begin;/im);
  assert.match(rollbackSmoke, /^rollback;/im);
  assert.doesNotMatch(rollbackSmoke, /\bcommit\s*;/i);
  assert.match(rollbackSmoke, /presence_required/i);
  assert.match(rollbackSmoke, /presence_target_changed/i);
  assert.match(rollbackSmoke, /presence_invalid/i);
  assert.match(rollbackSmoke, /presence_replayed/i);
  assert.match(rollbackSmoke, /certificate,payload,presence,verified/i);
});
