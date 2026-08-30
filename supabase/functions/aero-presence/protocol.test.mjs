import assert from "node:assert/strict";
import test from "node:test";
import {
  base64urlToBytes,
  bytesToBase64url,
  digestValue,
  hashToken,
  normalizeTarget,
  recentInteractiveAuthentication,
  removalContract,
} from "./protocol.mjs";

const user = "123e4567-e89b-42d3-a456-426614174000";
const digest = "a".repeat(64);

function token(payload) {
  return `${bytesToBase64url(new TextEncoder().encode("{}"))}.${bytesToBase64url(new TextEncoder().encode(JSON.stringify(payload)))}.signature`;
}

test("base64url round trips bytes without padding", () => {
  const bytes = Uint8Array.from([0, 1, 2, 253, 254, 255]);
  const encoded = bytesToBase64url(bytes);
  assert.doesNotMatch(encoded, /[+/=]/);
  assert.deepEqual(Array.from(base64urlToBytes(encoded)), Array.from(bytes));
});

test("approval targets close type, identity, digest, and current raw token", () => {
  const value = normalizeTarget({ targetType: "run", targetId: user, contractDigest: digest, approvalToken: "x".repeat(43) });
  assert.equal(value.targetType, "run");
  assert.throws(() => normalizeTarget({ ...value, targetType: "email" }), /invalid/i);
  assert.throws(() => normalizeTarget({ ...value, contractDigest: "bad" }), /invalid/i);
  assert.throws(() => normalizeTarget({ ...value, approvalToken: "short" }), /invalid/i);
});

test("fresh-auth bootstrap ignores refreshed JWT issuance and uses AMR evidence", () => {
  const now = 2_000_000_000;
  assert.equal(recentInteractiveAuthentication(token({ iat: now, amr: [{ method: "oauth", timestamp: now - 30 }] }), now), true);
  assert.equal(recentInteractiveAuthentication(token({ iat: now, amr: [{ method: "oauth", timestamp: now - 2_000 }, { method: "token_refresh", timestamp: now }] }), now), false);
  assert.equal(recentInteractiveAuthentication(token({ iat: now }), now), false);
});

test("management removal has a deterministic exact contract", async () => {
  const contract = removalContract(user);
  assert.equal(contract.credentialId, user);
  assert.equal(await digestValue(contract), await digestValue(structuredClone(contract)));
});

test("raw presence tokens are never their stored digest", async () => {
  const raw = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
  const hashed = await hashToken(raw);
  assert.equal(hashed.length, 64);
  assert.notEqual(raw, hashed);
});

