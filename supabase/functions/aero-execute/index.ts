/*
 * Authenticated execution gateway for Aero inside Lyfe.
 *
 * The function verifies the caller with Supabase Auth, keeps the service-role
 * credential server-only, validates a closed set of reversible Lyfe actions,
 * and delegates the final compare-and-swap commit to one Postgres transaction.
 * It does not call an LLM and it never accepts external side effects.
 */

import { createClient } from "npm:@supabase/supabase-js@2.110.2";
import postgres from "npm:postgres@3.4.3";
import {
  ProtocolError,
  hashToken,
  isDigest,
  isUuid,
  prepareRunMaterial,
  randomToken,
} from "./protocol.mjs";

const MAX_BODY_BYTES = 48_000;
const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 40;
const APPROVAL_TTL_MS = 2 * 60_000;
const ALLOWED_ORIGINS = new Set([
  "https://sonnesystems.com",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:8773",
  "http://127.0.0.1:8774",
  "http://localhost:4173",
]);

const buckets = new Map<string, number[]>();
const databaseUrl = String(Deno.env.get("SUPABASE_DB_URL") || "");
const vaultSql = databaseUrl
  ? postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 15, connect_timeout: 5 })
  : null;
let allowlistCache: { ids: Set<string>; loadedAt: number } | null = null;

function responseHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://sonnesystems.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function json(origin: string | null, status: number, value: unknown) {
  return new Response(JSON.stringify(value), { status, headers: responseHeaders(origin) });
}

function cleanText(value: unknown, max = 500) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

function withinRateLimit(subject: string) {
  const now = Date.now();
  const recent = (buckets.get(subject) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= REQUESTS_PER_WINDOW) return false;
  recent.push(now);
  buckets.set(subject, recent);
  return true;
}

async function allowedUserIds() {
  if (allowlistCache && Date.now() - allowlistCache.loadedAt < 5 * 60_000) return allowlistCache.ids;
  let raw = String(Deno.env.get("AERO_ALLOWED_USER_IDS") || "").trim();
  if (!raw && vaultSql) {
    const rows = await vaultSql<Array<{ decrypted_secret: string }>>`
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'aero_allowed_user_ids'
      limit 1
    `;
    raw = String(rows[0]?.decrypted_secret || "").trim();
  }
  const ids = new Set(raw.split(",").map((value) => value.trim()).filter(isUuid));
  allowlistCache = { ids, loadedAt: Date.now() };
  return ids;
}

async function authenticatedUser(authorization: string) {
  const url = String(Deno.env.get("SUPABASE_URL") || "");
  const anonKey = String(Deno.env.get("SUPABASE_ANON_KEY") || "");
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !token) return null;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await client.auth.getUser(token);
  return result.error ? null : result.data.user;
}

function adminClient() {
  const url = String(Deno.env.get("SUPABASE_URL") || "");
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function rpcError(error: unknown) {
  if (!error || typeof error !== "object") return "execution_unavailable";
  const value = error as Record<string, unknown>;
  return cleanText(value.code || value.message || "execution_unavailable", 160);
}

function statusForError(code: string) {
  if (code === "run_not_found") return 404;
  if (code === "not_allowed") return 403;
  if (code === "run_integrity_failed" || code === "journal_integrity_failed") return 500;
  if (code === "state_missing") return 409;
  if ([
    "idempotency_conflict", "prepare_race_retry", "contract_changed", "approval_replayed",
    "run_not_prepared", "approval_expired", "approval_invalid", "state_changed",
  ].includes(code)) return 409;
  return 400;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json(origin, 403, { error: "origin_not_allowed" });
    return new Response("ok", { headers: responseHeaders(origin) });
  }
  if (req.method !== "POST") return json(origin, 405, { error: "method_not_allowed" });
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(origin, 403, { error: "origin_not_allowed" });
  const declaredSize = Number(req.headers.get("content-length") || 0);
  if (declaredSize > MAX_BODY_BYTES) return json(origin, 413, { error: "request_too_large" });

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json(origin, 413, { error: "request_too_large" });
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid body");
  } catch (_) {
    return json(origin, 400, { error: "invalid_json" });
  }

  const authorization = String(req.headers.get("authorization") || "");
  let user = null;
  try { user = await authenticatedUser(authorization); } catch (_) { /* shaped below */ }
  if (!user || !isUuid(user.id)) return json(origin, 401, { error: "authentication_required" });
  if (!withinRateLimit(user.id)) return json(origin, 429, { error: "rate_limited" });
  try {
    const allowed = await allowedUserIds();
    if (!allowed.has(user.id)) return json(origin, 403, { error: "not_allowed" });
  } catch (_) {
    return json(origin, 503, { error: "execution_not_configured" });
  }

  const admin = adminClient();
  if (!admin) return json(origin, 503, { error: "execution_not_configured" });
  const op = cleanText(body.op, 40);

  try {
    if (op === "prepare") {
      const requestKey = cleanText(body.requestKey, 160);
      const intent = cleanText(body.intent, 1_000);
      const stateResult = await admin.from("lyfe_states")
        .select("data, rev")
        .eq("user_id", user.id)
        .maybeSingle();
      if (stateResult.error) return json(origin, 503, { error: "state_unavailable" });
      if (!stateResult.data) return json(origin, 409, { error: "state_missing" });
      const runId = crypto.randomUUID();
      const now = Date.now();
      const material = await prepareRunMaterial({
        userId: user.id,
        requestKey,
        runId,
        intent,
        actions: body.actions,
        state: stateResult.data.data,
        rev: Number(stateResult.data.rev || 0),
      });
      const approvalToken = randomToken();
      const approvalHash = await hashToken(approvalToken);
      const expiresAt = new Date(now + APPROVAL_TTL_MS).toISOString();
      const parameters = {
        p_run_id: material.runId,
        p_user_id: user.id,
        p_request_key: material.requestKey,
        p_contract: material.contract,
        p_contract_digest: material.contractDigest,
        p_base_rev: material.baseRev,
        p_before_digest: material.beforeDigest,
        p_target_data: material.targetData,
        p_target_digest: material.targetDigest,
        p_patches: material.patches,
        p_review: material.review,
        p_approval_token_hash: approvalHash,
        p_approval_expires_at: expiresAt,
      };
      let prepared = await admin.rpc("aero_prepare_run", parameters);
      if (!prepared.error && prepared.data?.error === "prepare_race_retry") {
        prepared = await admin.rpc("aero_prepare_run", parameters);
      }
      if (prepared.error) return json(origin, 503, { error: "execution_unavailable", detail: rpcError(prepared.error) });
      const result = prepared.data || {};
      if (!result.ok) return json(origin, statusForError(String(result.error || "")), result);
      return json(origin, 200, {
        ...result,
        protocol: material.protocol,
        approvalToken: result.status === "prepared" ? approvalToken : null,
        approvalExpiresAt: result.status === "prepared" ? expiresAt : null,
      });
    }

    if (op === "commit") {
      const runId = cleanText(body.runId, 80);
      const contractDigest = cleanText(body.contractDigest, 80);
      const approvalToken = cleanText(body.approvalToken, 200);
      if (!isUuid(runId) || !isDigest(contractDigest) || approvalToken.length < 32) {
        throw new ProtocolError("COMMIT_INPUT", "The approval binding is invalid.");
      }
      const committed = await admin.rpc("aero_commit_run", {
        p_user_id: user.id,
        p_run_id: runId,
        p_contract_digest: contractDigest,
        p_approval_token_hash: await hashToken(approvalToken),
      });
      if (committed.error) return json(origin, 503, { error: "execution_unavailable", detail: rpcError(committed.error) });
      const result = committed.data || {};
      return json(origin, result.ok ? 200 : statusForError(String(result.error || "")), result);
    }

    if (op === "cancel" || op === "forget") {
      const runId = cleanText(body.runId, 80);
      const contractDigest = cleanText(body.contractDigest, 80);
      if (!isUuid(runId) || !isDigest(contractDigest)) {
        throw new ProtocolError("RUN_INPUT", "The run binding is invalid.");
      }
      const result = await admin.rpc(op === "cancel" ? "aero_cancel_run" : "aero_forget_run", {
        p_user_id: user.id,
        p_run_id: runId,
        p_contract_digest: contractDigest,
      });
      if (result.error) return json(origin, 503, { error: "execution_unavailable", detail: rpcError(result.error) });
      const value = result.data || {};
      return json(origin, value.ok ? 200 : statusForError(String(value.error || "")), value);
    }

    if (op === "inspect") {
      const runId = cleanText(body.runId, 80);
      if (!isUuid(runId)) throw new ProtocolError("RUN_INPUT", "The run identity is invalid.");
      const inspected = await admin.rpc("aero_inspect_run", { p_user_id: user.id, p_run_id: runId });
      if (inspected.error) return json(origin, 503, { error: "execution_unavailable", detail: rpcError(inspected.error) });
      const result = inspected.data || {};
      return json(origin, result.ok ? 200 : statusForError(String(result.error || "")), result);
    }

    return json(origin, 400, { error: "operation_unsupported" });
  } catch (error) {
    if (error instanceof ProtocolError) return json(origin, error.status, { error: error.code, message: error.message });
    return json(origin, 500, { error: "execution_failed_closed" });
  }
});
