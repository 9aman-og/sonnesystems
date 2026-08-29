# Aero server execution boundary

## Purpose

The browser harness is useful, but code that proposes, authorizes, executes,
audits, and rolls back in one JavaScript process does not create a strong trust
boundary. This reference service moves the durable authority and recovery plane
into FastAPI and SQLite while keeping Lyfe's consumer interface unchanged.

This service is implemented and tested but is not deployed or connected to the
public Lyfe build yet.

## Protocol

One run moves through a closed state machine:

```text
prepared -> approved -> leased -> completed
                         |
                         +-> recovery_required -> recovering -> recovered
```

1. **Prepare** validates a closed action schema, derives exact capabilities and
   acceptance criteria, encrypts the normalized contract, and commits the first
   journal event.
2. **Approve** binds a short-lived, one-use authority token to the server-owned
   contract digest.
3. **Lease** consumes that token, validates a projected Lyfe snapshot, simulates
   every action, and returns deterministic patches. The encrypted before and
   exact target snapshots are committed before the client receives a lease.
4. **Attest** accepts only the one target-state digest produced by the server.
   A mismatch moves the run to `recovery_required`.
5. **Recover** returns the authenticated user's encrypted-before snapshot and a
   fresh, one-use recovery token. Confirmation must hash to the exact before
   state.
6. **Forget** deletes both the run and its event chain.

Every mutation is optimistic-concurrency protected. Approval, lease, and
recovery tokens are stored only as SHA-256 hashes. Contract, event payload, and
snapshot columns use AES-256-GCM with distinct associated data. The event log is
also hash chained and checked before every state transition.

## Supported capabilities

The first isolated route intentionally covers reversible Lyfe records:

- tasks: create and complete;
- Library: create note and document;
- Tracking: log work, create goal, and create education item;
- projects: create project.

Typed memory remains on Aero's separate local transaction system. Gmail sends,
messages, shell commands, arbitrary network calls, and other external effects
are denied by the server schema.

## Privacy boundary

The service receives only the projected collections required for the bounded
run, not Aero chat history, Gmail, Connect, or the full context pack. Transport
must use TLS. Plaintext exists in server memory while a request is processed;
stored values are encrypted with `SONNE_AERO_JOURNAL_KEY`. The service fails
closed when that 32-byte base64url key is absent or malformed.

No key is committed to this repository. The deterministic key in `conftest.py`
is test material only.

## Evidence

`tests/test_aero_runs.py` covers:

- exact contract binding and one-use approval;
- approval replay and payload-smuggling rejection;
- idempotency-key rebinding denial;
- ambiguous target and malformed snapshot denial;
- encrypted-at-rest contract and state checks;
- event, contract, and target-ciphertext corruption;
- postcondition mismatch and exact recovery;
- expiry renewal and app-restart recovery;
- cross-account isolation and explicit erasure;
- optimistic lost-update rejection;
- fail-closed startup without an encryption key.

## Limits and next gates

- The public site does not call this backend yet.
- A fully compromised browser can submit the server's expected target snapshot
  without actually applying it. A trusted local companion or server-owned Lyfe
  store is required to attest physical client state.
- Approval currently proves an authenticated bearer session, not independent
  user presence. WebAuthn approval is the next authority upgrade.
- Key rotation, KMS/HSM custody, multi-instance rate limits, and database
  migrations need deployment work.
- External side effects need capability-specific executors, read-only graders,
  and compensators before they can enter this route.

These limits keep the claim precise: v0.1 proves a durable, encrypted authority
and recovery protocol for reversible Lyfe records. It does not yet prove a
deployed, compromise-resistant executor for arbitrary tools.
