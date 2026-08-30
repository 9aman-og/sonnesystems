/*
 * Authenticated gateway for Aero's private, server-owned typed memory.
 *
 * The function is model-neutral. It verifies the caller, enforces the private
 * account allowlist, reads only the caller's authoritative memory state, and
 * delegates every commit to a single Postgres transaction. Explicit writes
 * require a one-use exact-plan approval token. Outcome observations can only
 * create or update behavior-authority candidates and are committed from the
 * feedback click that supplied the evidence.
 */

import { createClient } from "npm:@supabase/supabase-js@2.110.2";
import postgres from "npm:postgres@3.4.3";
import {
  ProtocolError,
  digestValue,
  hashToken,
  isDigest,
  isUuid,
  memoryMetrics,
  normalizeState,
  prepareMemoryMaterial,
  randomToken,
} from "./protocol.mjs";

const MAX_BODY_BYTES = 48_000;
const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 60;
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
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function rpcError(error: unknown) {
  if (!error || typeof error !== "object") return "memory_unavailable";
  const value = error as Record<string, unknown>;
  return cleanText(value.code || value.message || "memory_unavailable", 160);
}

function statusForError(code: string) {
  if (code === "memory_transaction_not_found") return 404;
  if (code === "not_allowed") return 403;
  if (["memory_integrity_failed", "memory_journal_integrity_failed"].includes(code)) return 500;
  if ([
    "memory_state_changed", "memory_approval_expired", "memory_approval_replayed",
    "memory_approval_invalid", "memory_contract_changed", "memory_prepare_race_retry",
    "presence_required", "presence_invalid", "presence_replayed", "presence_expired",
    "memory_idempotency_conflict", "memory_transaction_not_prepared",
  ].includes(code)) return 409;
  return 400;
}

async function readState(admin: ReturnType<typeof adminClient>, userId: string) {
  if (!admin) throw new ProtocolError("MEMORY_NOT_CONFIGURED", "The memory route is not configured.", 503);
  const result = await admin.rpc("aero_read_memory_state", { p_user_id: userId });
  if (result.error) throw new ProtocolError("MEMORY_UNAVAILABLE", rpcError(result.error), 503);
  const value = result.data || {};
  if (!value.ok || !value.state) {
    const code = cleanText(value.error || "memory_unavailable", 80);
    throw new ProtocolError(code.toUpperCase(), "Aero could not verify private memory.", statusForError(code));
  }
  const state = normalizeState(value.state);
  const canonicalDigest = await digestValue(state);
  if (value.canonicalDigestBound !== true) {
    const bound = await admin.rpc("aero_bind_memory_canonical_digest", {
      p_user_id: userId,
      p_revision: Number(value.revision || 0),
      p_canonical_digest: canonicalDigest,
    });
    if (bound.error || !(bound.data && bound.data.ok)) {
      throw new ProtocolError("MEMORY_INTEGRITY_FAILED", "Aero could not bind private memory integrity.", 500);
    }
    return { ...value, ...bound.data, state, stateDigest: canonicalDigest, canonicalDigestBound: true };
  }
  if (!isDigest(value.stateDigest) || value.stateDigest !== canonicalDigest) {
    throw new ProtocolError("MEMORY_INTEGRITY_FAILED", "Aero could not verify private memory.", 500);
  }
  return { ...value, state, stateDigest: canonicalDigest };
}

async function prepareStored(admin: NonNullable<ReturnType<typeof adminClient>>, userId: string, body: Record<string, unknown>) {
  const current = await readState(admin, userId);
  const transactionId = crypto.randomUUID();
  const material = await prepareMemoryMaterial({
    userId,
    requestKey: body.requestKey,
    state: current.state,
    stateDigest: current.stateDigest,
    revision: Number(current.revision || 0),
    operations: body.operations,
    authorityNow: Math.floor(Date.now() / 86_400_000) * 86_400_000 + 43_200_000,
  });
  if (material.noChange) return { material, current, prepared: { ok: true, status: "noop" }, approvalToken: "", expiresAt: "" };
  const approvalToken = randomToken();
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS).toISOString();
  let prepared = await admin.rpc("aero_prepare_memory_transaction", {
    p_transaction_id: transactionId,
    p_user_id: userId,
    p_request_key: material.requestKey,
    p_operation: material.operations,
    p_operation_digest: material.operationDigest,
    p_contract: material.contract,
    p_contract_digest: material.contractDigest,
    p_base_revision: material.baseRevision,
    p_before_digest: material.beforeDigest,
    p_target_state: material.targetState,
    p_target_digest: material.targetDigest,
    p_review: material.review,
    p_approval_token_hash: await hashToken(approvalToken),
    p_approval_expires_at: expiresAt,
  });
  if (!prepared.error && prepared.data?.error === "memory_prepare_race_retry") {
    prepared = await admin.rpc("aero_prepare_memory_transaction", {
      p_transaction_id: transactionId,
      p_user_id: userId,
      p_request_key: material.requestKey,
      p_operation: material.operations,
      p_operation_digest: material.operationDigest,
      p_contract: material.contract,
      p_contract_digest: material.contractDigest,
      p_base_revision: material.baseRevision,
      p_before_digest: material.beforeDigest,
      p_target_state: material.targetState,
      p_target_digest: material.targetDigest,
      p_review: material.review,
      p_approval_token_hash: await hashToken(approvalToken),
      p_approval_expires_at: expiresAt,
    });
  }
  if (prepared.error) throw new ProtocolError("MEMORY_UNAVAILABLE", rpcError(prepared.error), 503);
  if (!(prepared.data && prepared.data.ok)) {
    throw new ProtocolError(cleanText(prepared.data?.error || "MEMORY_PREPARE_FAILED", 80), "Aero could not bind this memory change.", statusForError(String(prepared.data?.error || "")));
  }
  return { material, current, prepared: prepared.data, approvalToken, expiresAt };
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
    return json(origin, 503, { error: "memory_not_configured" });
  }

  const admin = adminClient();
  if (!admin) return json(origin, 503, { error: "memory_not_configured" });
  const op = cleanText(body.op, 40);

  try {
    if (op === "read") {
      const current = await readState(admin, user.id);
      return json(origin, 200, {
        ok: true,
        protocol: "aero-memory-v0.3",
        revision: Number(current.revision || 0),
        stateDigest: current.stateDigest,
        state: normalizeState(current.state),
        metrics: memoryMetrics(current.state),
      });
    }

    if (op === "prepare") {
      const prepared = await prepareStored(admin, user.id, body);
      if (prepared.material.noChange) {
        return json(origin, 200, {
          ok: true, status: "noop", protocol: prepared.material.protocol,
          revision: Number(prepared.current.revision || 0), state: normalizeState(prepared.current.state),
          metrics: memoryMetrics(prepared.current.state),
        });
      }
      const presence = await admin.rpc("aero_presence_status", { p_user_id: user.id });
      if (presence.error || !presence.data?.ok) return json(origin, 503, { error: "presence_unavailable" });
      return json(origin, 200, {
        ...prepared.prepared,
        protocol: prepared.material.protocol,
        contractDigest: prepared.material.contractDigest,
        baseRevision: prepared.material.baseRevision,
        review: prepared.material.review,
        presenceRequired: presence.data.enrolled === true,
        approvalToken: prepared.approvalToken,
        approvalExpiresAt: prepared.expiresAt,
      });
    }

    if (op === "commit") {
      const transactionId = cleanText(body.transactionId, 80);
      const contractDigest = cleanText(body.contractDigest, 80);
      const approvalToken = cleanText(body.approvalToken, 200);
      const presenceToken = cleanText(body.presenceToken, 200);
      if (!isUuid(transactionId) || !isDigest(contractDigest) || approvalToken.length < 32) {
        throw new ProtocolError("MEMORY_COMMIT_INPUT", "The approval binding is invalid.");
      }
      const committed = await admin.rpc("aero_commit_memory_transaction", {
        p_user_id: user.id,
        p_transaction_id: transactionId,
        p_contract_digest: contractDigest,
        p_approval_token_hash: await hashToken(approvalToken),
        p_presence_token_hash: presenceToken.length >= 32 ? await hashToken(presenceToken) : null,
      });
      if (committed.error) return json(origin, 503, { error: "memory_unavailable", detail: rpcError(committed.error) });
      const result = committed.data || {};
      if (!result.ok) return json(origin, statusForError(String(result.error || "")), result);
      if (!isDigest(result.stateDigest) || await digestValue(normalizeState(result.state)) !== result.stateDigest) {
        throw new ProtocolError("MEMORY_INTEGRITY_FAILED", "Aero could not verify the committed memory state.", 500);
      }
      return json(origin, 200, { ...result, metrics: memoryMetrics(result.state) });
    }

    if (op === "observe") {
      const rawOperations = Array.isArray(body.operations) ? body.operations : [];
      if (!rawOperations.length || rawOperations.some((operation) => !operation || typeof operation !== "object" || operation.type !== "observe")) {
        throw new ProtocolError("MEMORY_CAPABILITY_DENIED", "The observation route accepts outcome evidence only.");
      }
      const prepared = await prepareStored(admin, user.id, body);
      if (prepared.material.operations.some((operation) => operation.type !== "observe")) {
        throw new ProtocolError("MEMORY_CAPABILITY_DENIED", "The observation route accepts outcome evidence only.");
      }
      if (prepared.material.noChange) {
        return json(origin, 200, {
          ok: true, status: "noop", revision: Number(prepared.current.revision || 0),
          state: normalizeState(prepared.current.state), metrics: memoryMetrics(prepared.current.state),
        });
      }
      const committed = await admin.rpc("aero_commit_memory_transaction", {
        p_user_id: user.id,
        p_transaction_id: prepared.prepared.transactionId,
        p_contract_digest: prepared.material.contractDigest,
        p_approval_token_hash: await hashToken(prepared.approvalToken),
        p_presence_token_hash: null,
      });
      if (committed.error) return json(origin, 503, { error: "memory_unavailable", detail: rpcError(committed.error) });
      const result = committed.data || {};
      if (!result.ok) return json(origin, statusForError(String(result.error || "")), result);
      if (!isDigest(result.stateDigest) || await digestValue(normalizeState(result.state)) !== result.stateDigest) {
        throw new ProtocolError("MEMORY_INTEGRITY_FAILED", "Aero could not verify the committed memory state.", 500);
      }
      return json(origin, 200, { ...result, metrics: memoryMetrics(result.state) });
    }

    if (["cancel", "forget_transaction"].includes(op)) {
      const transactionId = cleanText(body.transactionId, 80);
      const contractDigest = cleanText(body.contractDigest, 80);
      if (!isUuid(transactionId) || !isDigest(contractDigest)) throw new ProtocolError("MEMORY_TRANSACTION_INPUT", "The transaction binding is invalid.");
      const result = await admin.rpc(op === "cancel" ? "aero_cancel_memory_transaction" : "aero_forget_memory_transaction", {
        p_user_id: user.id,
        p_transaction_id: transactionId,
        p_contract_digest: contractDigest,
      });
      if (result.error) return json(origin, 503, { error: "memory_unavailable", detail: rpcError(result.error) });
      const value = result.data || {};
      return json(origin, value.ok ? 200 : statusForError(String(value.error || "")), value);
    }

    if (op === "inspect") {
      const transactionId = cleanText(body.transactionId, 80);
      if (!isUuid(transactionId)) throw new ProtocolError("MEMORY_TRANSACTION_INPUT", "The transaction identity is invalid.");
      const result = await admin.rpc("aero_inspect_memory_transaction", { p_user_id: user.id, p_transaction_id: transactionId });
      if (result.error) return json(origin, 503, { error: "memory_unavailable", detail: rpcError(result.error) });
      const value = result.data || {};
      return json(origin, value.ok ? 200 : statusForError(String(value.error || "")), value);
    }

    return json(origin, 400, { error: "operation_unsupported" });
  } catch (error) {
    if (error instanceof ProtocolError) return json(origin, error.status, { error: error.code.toLowerCase(), message: error.message });
    return json(origin, 500, { error: "memory_failed_closed" });
  }
});
