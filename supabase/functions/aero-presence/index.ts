/*
 * Authenticated, transaction-bound WebAuthn user-presence gateway for Aero.
 *
 * The authenticator signs a server challenge whose private database record is
 * bound to one prepared contract, its current one-use approval hash, caller,
 * origin, and expiry. The raw presence grant is returned once; only its hash is
 * stored. The target commit consumes it atomically in Postgres.
 */

import { createClient } from "npm:@supabase/supabase-js@2.110.2";
import postgres from "npm:postgres@3.4.3";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "jsr:@simplewebauthn/server@13.2.2";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
  WebAuthnCredential,
} from "jsr:@simplewebauthn/server@13.2.2";
import {
  CHALLENGE_TTL_MS,
  GRANT_TTL_MS,
  PRESENCE_PROTOCOL,
  PRODUCTION_ORIGIN,
  RP_ID,
  RP_NAME,
  PresenceError,
  base64urlToBytes,
  bytesToBase64url,
  cleanText,
  digestValue,
  hashToken,
  isDigest,
  isUuid,
  normalizeTarget,
  opaqueUserName,
  randomToken,
  recentInteractiveAuthentication,
  removalContract,
} from "./protocol.mjs";

const MAX_BODY_BYTES = 96_000;
const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 30;
const ALLOWED_ORIGINS = new Set([
  PRODUCTION_ORIGIN,
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
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : PRODUCTION_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
}

function json(origin: string | null, status: number, value: unknown) {
  return new Response(JSON.stringify(value), { status, headers: responseHeaders(origin) });
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
      select decrypted_secret from vault.decrypted_secrets
      where name = 'aero_allowed_user_ids' limit 1
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
  if (!error || typeof error !== "object") return "presence_unavailable";
  const value = error as Record<string, unknown>;
  return cleanText(value.code || value.message || "presence_unavailable", 160);
}

function statusForError(code: string) {
  if (["presence_credential_not_found", "presence_challenge_not_found", "run_not_found", "memory_transaction_not_found"].includes(code)) return 404;
  if (["not_allowed", "presence_secure_origin_required", "presence_recent_sign_in_required"].includes(code)) return 403;
  if (["presence_challenge_replayed", "presence_challenge_expired", "presence_target_changed", "presence_credential_exists", "approval_expired", "memory_approval_expired"].includes(code)) return 409;
  return 400;
}

function requireProductionOrigin(origin: string | null) {
  if (origin !== PRODUCTION_ORIGIN) {
    throw new PresenceError("presence_secure_origin_required", "Secure approval setup is available only on sonnesystems.com.", 403);
  }
}

function credentialList(status: Record<string, unknown>) {
  const values = Array.isArray(status.credentials) ? status.credentials : [];
  return values.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
}

async function statusFor(admin: ReturnType<typeof adminClient>, userId: string) {
  const result = await admin!.rpc("aero_presence_status", { p_user_id: userId });
  if (result.error) throw new PresenceError("presence_unavailable", rpcError(result.error), 503);
  return (result.data || { ok: false }) as Record<string, unknown>;
}

async function storeChallenge(admin: ReturnType<typeof adminClient>, userId: string, input: {
  ceremony: "registration" | "approval" | "credential_remove";
  challenge: string;
  targetType?: string | null;
  targetId?: string | null;
  contractDigest?: string | null;
  approvalTokenHash?: string | null;
}) {
  const challengeId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const result = await admin!.rpc("aero_prepare_presence_challenge", {
    p_user_id: userId,
    p_challenge_id: challengeId,
    p_ceremony: input.ceremony,
    p_challenge: input.challenge,
    p_target_type: input.targetType || null,
    p_target_id: input.targetId || null,
    p_contract_digest: input.contractDigest || null,
    p_approval_token_hash: input.approvalTokenHash || null,
    p_expires_at: expiresAt,
  });
  if (result.error) throw new PresenceError("presence_unavailable", rpcError(result.error), 503);
  const value = (result.data || {}) as Record<string, unknown>;
  if (!value.ok) throw new PresenceError(String(value.error || "presence_challenge_failed"), "The secure approval challenge could not be created.", statusForError(String(value.error || "")));
  return { challengeId, expiresAt };
}

async function readChallenge(admin: ReturnType<typeof adminClient>, userId: string, challengeId: string, credentialId = "") {
  const result = await admin!.rpc("aero_read_presence_challenge", {
    p_user_id: userId,
    p_challenge_id: challengeId,
    p_credential_id: credentialId,
  });
  if (result.error) throw new PresenceError("presence_unavailable", rpcError(result.error), 503);
  const value = (result.data || {}) as Record<string, unknown>;
  if (!value.ok) throw new PresenceError(String(value.error || "presence_challenge_failed"), "The secure approval challenge is no longer valid.", statusForError(String(value.error || "")));
  return value;
}

function transports(value: unknown): AuthenticatorTransportFuture[] {
  const allowed = new Set(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]);
  return (Array.isArray(value) ? value : []).map((item) => cleanText(item, 20)).filter((item) => allowed.has(item)) as AuthenticatorTransportFuture[];
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json(origin, 403, { error: "origin_not_allowed" });
    return new Response("ok", { headers: responseHeaders(origin) });
  }
  if (req.method !== "POST") return json(origin, 405, { error: "method_not_allowed" });
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(origin, 403, { error: "origin_not_allowed" });
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY_BYTES) return json(origin, 413, { error: "request_too_large" });

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
  const token = authorization.replace(/^Bearer\s+/i, "");
  let user = null;
  try { user = await authenticatedUser(authorization); } catch (_) { /* shaped below */ }
  if (!user || !isUuid(user.id)) return json(origin, 401, { error: "authentication_required" });
  if (!withinRateLimit(user.id)) return json(origin, 429, { error: "rate_limited" });
  try {
    const allowed = await allowedUserIds();
    if (!allowed.has(user.id)) return json(origin, 403, { error: "not_allowed" });
  } catch (_) {
    return json(origin, 503, { error: "presence_not_configured" });
  }
  const admin = adminClient();
  if (!admin) return json(origin, 503, { error: "presence_not_configured" });
  const op = cleanText(body.op, 40);

  try {
    if (op === "status") {
      const status = await statusFor(admin, user.id);
      return json(origin, 200, { ...status, protocol: PRESENCE_PROTOCOL, availableHere: origin === PRODUCTION_ORIGIN });
    }

    requireProductionOrigin(origin);

    if (op === "registration_start") {
      if (!recentInteractiveAuthentication(token)) {
        throw new PresenceError("presence_recent_sign_in_required", "Sign out and sign in again before adding a secure approval device.", 403);
      }
      const status = await statusFor(admin, user.id);
      if (status.enrolled) throw new PresenceError("presence_credential_exists", "A secure approval device is already enrolled.", 409);
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: new TextEncoder().encode(user.id),
        userName: opaqueUserName(user.id),
        userDisplayName: "Aero secure approvals",
        attestationType: "none",
        timeout: CHALLENGE_TTL_MS,
        authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      });
      const binding = await storeChallenge(admin, user.id, { ceremony: "registration", challenge: options.challenge });
      return json(origin, 200, { ok: true, protocol: PRESENCE_PROTOCOL, ...binding, options });
    }

    if (op === "registration_finish") {
      const challengeId = cleanText(body.challengeId, 80);
      if (!isUuid(challengeId) || !body.response || typeof body.response !== "object") {
        throw new PresenceError("presence_registration_invalid", "The registration response is invalid.");
      }
      const challenge = await readChallenge(admin, user.id, challengeId);
      const verification = await verifyRegistrationResponse({
        response: body.response as RegistrationResponseJSON,
        expectedChallenge: String(challenge.challenge || ""),
        expectedOrigin: PRODUCTION_ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo || !verification.registrationInfo.userVerified) {
        throw new PresenceError("presence_verification_failed", "The device did not verify the person.", 401);
      }
      const info = verification.registrationInfo;
      const credential = info.credential;
      const saved = await admin.rpc("aero_complete_presence_registration", {
        p_user_id: user.id,
        p_challenge_id: challengeId,
        p_credential_id: credential.id,
        p_public_key: bytesToBase64url(credential.publicKey),
        p_counter: credential.counter,
        p_transports: transports(credential.transports),
        p_device_type: info.credentialDeviceType,
        p_backed_up: info.credentialBackedUp,
        p_friendly_name: info.credentialDeviceType === "multiDevice" ? "Synced passkey" : "This device",
      });
      if (saved.error) throw new PresenceError("presence_unavailable", rpcError(saved.error), 503);
      const result = (saved.data || {}) as Record<string, unknown>;
      if (!result.ok) throw new PresenceError(String(result.error || "presence_registration_failed"), "The secure approval device was not saved.", statusForError(String(result.error || "")));
      return json(origin, 200, { ...result, protocol: PRESENCE_PROTOCOL });
    }

    if (op === "approval_start") {
      const target = normalizeTarget(body);
      const status = await statusFor(admin, user.id);
      const credentials = credentialList(status);
      if (!credentials.length) throw new PresenceError("presence_not_enrolled", "Secure approval is not enrolled.", 409);
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        timeout: CHALLENGE_TTL_MS,
        userVerification: "required",
        challenge: randomToken(),
        allowCredentials: credentials.map((credential) => ({
          id: String(credential.credentialId || ""),
          transports: transports(credential.transports),
        })),
      });
      const binding = await storeChallenge(admin, user.id, {
        ceremony: "approval",
        challenge: options.challenge,
        targetType: target.targetType,
        targetId: target.targetId,
        contractDigest: target.contractDigest,
        approvalTokenHash: await hashToken(target.approvalToken),
      });
      return json(origin, 200, { ok: true, protocol: PRESENCE_PROTOCOL, ...binding, options });
    }

    if (op === "credential_remove_start") {
      const status = await statusFor(admin, user.id);
      const credentials = credentialList(status);
      if (credentials.length !== 1 || !isUuid(String(credentials[0].id || ""))) {
        throw new PresenceError("presence_credential_not_found", "No secure approval device is enrolled.", 404);
      }
      const contract = removalContract(String(credentials[0].id));
      const contractDigest = await digestValue(contract);
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        timeout: CHALLENGE_TTL_MS,
        userVerification: "required",
        challenge: randomToken(),
        allowCredentials: [{
          id: String(credentials[0].credentialId || ""),
          transports: transports(credentials[0].transports),
        }],
      });
      const binding = await storeChallenge(admin, user.id, {
        ceremony: "credential_remove",
        challenge: options.challenge,
        targetType: "credential",
        targetId: String(credentials[0].id),
        contractDigest,
      });
      return json(origin, 200, { ok: true, protocol: PRESENCE_PROTOCOL, ...binding, contract, contractDigest, options });
    }

    if (op === "approval_finish" || op === "credential_remove_finish") {
      const challengeId = cleanText(body.challengeId, 80);
      const response = body.response as AuthenticationResponseJSON;
      if (!isUuid(challengeId) || !response || typeof response !== "object" || !cleanText(response.id, 1100)) {
        throw new PresenceError("presence_assertion_invalid", "The secure approval response is invalid.");
      }
      const challenge = await readChallenge(admin, user.id, challengeId, cleanText(response.id, 1100));
      const expectedCeremony = op === "approval_finish" ? "approval" : "credential_remove";
      if (challenge.ceremony !== expectedCeremony) throw new PresenceError("presence_ceremony_mismatch", "The secure approval ceremony changed.", 409);
      const savedCredential = (challenge.credential || {}) as Record<string, unknown>;
      const credential: WebAuthnCredential = {
        id: String(savedCredential.credentialId || ""),
        publicKey: base64urlToBytes(String(savedCredential.publicKey || "")),
        counter: Number(savedCredential.counter || 0),
        transports: transports(savedCredential.transports),
      };
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: String(challenge.challenge || ""),
        expectedOrigin: PRODUCTION_ORIGIN,
        expectedRPID: RP_ID,
        credential,
        requireUserVerification: true,
        advancedFIDOConfig: { userVerification: "required" },
      });
      if (!verification.verified || !verification.authenticationInfo.userVerified) {
        throw new PresenceError("presence_verification_failed", "The device did not verify the person.", 401);
      }
      const presenceToken = op === "approval_finish" ? randomToken() : "";
      const grantExpiresAt = new Date(Date.now() + GRANT_TTL_MS).toISOString();
      const completed = await admin.rpc("aero_complete_presence_assertion", {
        p_user_id: user.id,
        p_challenge_id: challengeId,
        p_credential_id: response.id,
        p_new_counter: verification.authenticationInfo.newCounter,
        p_grant_token_hash: presenceToken ? await hashToken(presenceToken) : null,
        p_grant_expires_at: presenceToken ? grantExpiresAt : null,
      });
      if (completed.error) throw new PresenceError("presence_unavailable", rpcError(completed.error), 503);
      const result = (completed.data || {}) as Record<string, unknown>;
      if (!result.ok) throw new PresenceError(String(result.error || "presence_completion_failed"), "The secure approval could not be completed.", statusForError(String(result.error || "")));
      return json(origin, 200, {
        ...result,
        protocol: PRESENCE_PROTOCOL,
        presenceToken: presenceToken || undefined,
        presenceExpiresAt: presenceToken ? grantExpiresAt : undefined,
      });
    }

    return json(origin, 400, { error: "operation_unsupported" });
  } catch (error) {
    if (error instanceof PresenceError) return json(origin, error.status, { error: error.code, message: error.message });
    return json(origin, 400, { error: "presence_verification_failed", message: "Secure approval failed closed." });
  }
});

