/* Pure helpers for Aero's transaction-bound WebAuthn presence gateway. */

export const PRESENCE_PROTOCOL = "aero-presence-v0.1";
export const RP_ID = "sonnesystems.com";
export const RP_NAME = "Aero";
export const PRODUCTION_ORIGIN = "https://sonnesystems.com";
export const CHALLENGE_TTL_MS = 5 * 60_000;
export const GRANT_TTL_MS = 60_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST_RE = /^[0-9a-f]{64}$/;

export class PresenceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "PresenceError";
    this.code = code;
    this.status = status;
  }
}

export function cleanText(value, max = 500) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

export function isUuid(value) {
  return UUID_RE.test(String(value || ""));
}

export function isDigest(value) {
  return DIGEST_RE.test(String(value || ""));
}

export function randomToken(byteLength = 32) {
  return bytesToBase64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function bytesToBase64url(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value || []);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64urlToBytes(value) {
  const clean = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = clean + "=".repeat((4 - clean.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonical(value[key]);
    return result;
  }, {});
}

export async function digestValue(value) {
  const encoded = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoded));
  return Array.from(digest).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(value) {
  return digestValue(String(value || ""));
}

export function opaqueUserName(userId) {
  if (!isUuid(userId)) throw new PresenceError("PRESENCE_USER", "The account identity is invalid.", 401);
  return `aero-${String(userId).replace(/-/g, "").slice(0, 16)}`;
}

export function removalContract(credentialId) {
  if (!isUuid(credentialId)) throw new PresenceError("PRESENCE_CREDENTIAL", "The secure approval device is invalid.");
  return Object.freeze({
    protocol: PRESENCE_PROTOCOL,
    action: "remove-secure-approval-device",
    credentialId,
  });
}

export function recentInteractiveAuthentication(token, nowSeconds = Math.floor(Date.now() / 1000), windowSeconds = 15 * 60) {
  try {
    const payloadPart = String(token || "").split(".")[1] || "";
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadPart)));
    const methods = Array.isArray(payload.amr) ? payload.amr : [];
    const interactive = methods
      .filter((entry) => entry && typeof entry === "object" && entry.method !== "token_refresh")
      .map((entry) => Number(entry.timestamp || 0))
      .filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0);
    const latest = interactive.length ? Math.max(...interactive) : 0;
    return latest > 0 && nowSeconds - latest >= 0 && nowSeconds - latest <= windowSeconds;
  } catch (_) {
    return false;
  }
}

export function normalizeTarget(value) {
  const targetType = cleanText(value && value.targetType, 20);
  const targetId = cleanText(value && value.targetId, 80);
  const contractDigest = cleanText(value && value.contractDigest, 80);
  const approvalToken = cleanText(value && value.approvalToken, 200);
  if (!["run", "memory"].includes(targetType) || !isUuid(targetId)
      || !isDigest(contractDigest) || approvalToken.length < 32) {
    throw new PresenceError("PRESENCE_TARGET", "The exact approval target is invalid.");
  }
  return { targetType, targetId, contractDigest, approvalToken };
}

