# Aero transactional memory

## Product rule

Aero memory is not a transcript and it is not an append-only bag of facts. A
memory may influence a response only while its source, authority, validity, and
dependencies remain current.

## v0.3 data model

Every memory carries:

- one typed scope: episodic, semantic, project, or procedural;
- a stable memory key for conservative conflict detection;
- source mode and structured source references;
- status, confidence, valid-from and valid-until times;
- revision and commit identifiers;
- supersedes / superseded-by lineage;
- dependency and invalidated-by edges;
- evidence, contradictions, and outcome counts.

The prompt receives only `active` and `provisional` memories. Candidate,
disputed, superseded, and invalidated records remain inspectable but cannot
quietly steer Aero.

For a signed-in account, the private `aero_private` Postgres ledger is the
authority. The Lyfe document and browser keep only a read-through display cache
and cannot commit a memory revision. If authority cannot be verified, that cache
is quarantined and memory is visibly paused. Every server state has both a
canonical protocol digest and a separately computed database storage digest. A
new or legacy account is storage-validated, normalized by the protocol, and
bound once to that canonical digest before its ledger can be extended.

## Conflict policy

The conflict governor is deliberately asymmetric:

1. A direct user statement can supersede an earlier memory in the same stable
   slot.
2. An inferred memory cannot supersede a direct statement. It is held as
   disputed.
3. Direct confirmation of a disputed claim resolves competing active revisions
   into one current memory.
4. Claims without a structurally clear shared slot are allowed to coexist. Aero
   does not invent a contradiction from semantic similarity alone.

The v0.2 automatic slot parser is intentionally narrow. It recognizes stable
copular facts such as “my timezone is …”. Product or tool code can supply an
explicit `memoryKey`, `supersedes`, and `dependsOn` when the relationship is
known. A future semantic conflict detector must remain advisory until its false
conflict rate is measured.

## Transaction and recovery model

Each mutation creates a bounded journal transaction with the affected before and
after images, revision, source references, reason, and a chained integrity
fingerprint. The chain detects changed, deleted-head, and reordered entries.
Corrections can invalidate dependent memories recursively across multiple hops.
Missing, stale, and cyclic dependencies are held out before they can reach a
prompt.

The latest clean transaction can be restored when its affected memories have
not moved to a newer revision. Recovery fails closed when the journal is
corrupted or newer work depends on the current state.

“Forget” is different: it removes the memory and scrubs its claim from historic
journal images. That privacy deletion is marked non-reversible. Dependants are
kept only as invalidated records so the system can explain why they stopped
applying without retaining the forgotten claim.

The local fingerprint detects accidental cache corruption; it is not an
authorization signature. The signed-in path adds a private hash-chained event
ledger, exact target contract, two-minute one-use approval hash, row lock,
compare-and-swap revision, relational projection, and completion certificate in
one Postgres transaction. Completed, stale, cancelled, and expired transactions
redact raw claims and target states while retaining only digests and minimal
evidence. Forget and reset also remove claims from historical memory images.

When an account enrolls an Aero approval device, every explicit `teach`,
`confirm`, `forget`, `reset`, or other non-observation memory operation also
requires a fresh WebAuthn user-verification assertion bound to the exact memory
transaction and its current approval hash. Outcome feedback may still append a
behavior-only `observe` candidate automatically because it cannot promote,
supersede, forget, or reset a personal fact. The one-use presence grant and the
memory target are consumed atomically; assertion replay or target drift changes
neither memory nor revision.

## Evidence basis

- [STALE](https://arxiv.org/html/2605.06527) shows that retrieving an update is
  not enough: assistants must resolve implicit conflicts and invalidate
  downstream beliefs.
- [MemTxn](https://arxiv.org/html/2607.27834) motivates source-supported memory
  commits, version resolution, a durable snapshot journal, and application-
  visible recovery.
- [EOPA](https://arxiv.org/html/2608.04416v1) supports outcome-driven online
  preference adaptation without retraining the base model.
- [LongMemEval](https://arxiv.org/html/2410.10813v2) and
  [LoCoMo](https://aclanthology.org/2024.acl-long.747/) show that long-horizon
  memory must handle temporal reasoning and updates, not merely retrieve text.
- [MemoryAgentBench](https://github.com/HUST-AI-HYZ/MemoryAgentBench) separates
  retrieval, learning, long-range understanding, and selective forgetting.
- [StateMem](https://arxiv.org/html/2608.19652v1) motivates keeping a compact
  current state rather than repeatedly reconstructing truth from stale logs.
- [Meta's PAHF](https://ai.meta.com/research/publications/learning-personalized-agents-from-human-feedback/)
  supports adaptation from human feedback while preserving a distinction
  between evidence and an explicit user fact.
- [NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  informs the privacy, provenance, misuse, and measurement guardrails.

## Evaluation

`aero-memory.test.js` covers 22 deterministic lineage, authority, cascade,
recovery, privacy, integrity, migration, and idempotency groups, followed by a
fixed-seed sweep of 240 mixed mutations. Every mutation rechecks journal,
single-live-revision, and dependency-safety invariants.

`supabase/functions/aero-memory/protocol.test.mjs` adds the server protocol's
closed schema, deterministic contracts, explicit-versus-behavior authority,
dependency invalidation, privacy reset, journal tamper detection, and
accuracy-matched compression checks. `aero_server_owned_memory.test.mjs`
checks the private schema, RLS, grants, locks, redaction, projection, and event
chain. A production rollback-only transaction exercises prepare, commit,
projection, terminal redaction, token consumption, and replay denial without
retaining the disposable memory.

`supabase/tests/aero_memory_concurrency_rollback.sql` runs a second rollback-
only production trial. Two devices prepare from one revision; exactly one can
commit and the other is certified stale. A simulated crashed process then
resumes its original idempotent transaction with a rotated approval: the old
approval is rejected, the new approval commits, and the event/payload evidence
remains valid. The final rollback removes the disposable auth user and every
memory row.

`supabase/tests/aero_presence_atomic_rollback.sql` adds the cross-boundary
presence proof. It covers the legacy unenrolled path, enrolled fail-closed
behavior, exact target and approval binding, wrong-token atomicity, presence
certification, replay denial, and verified credential revocation while retaining
historical grant evidence. The final rollback and a post-run count verify that
the disposable user, credential, challenge, grant, run, and state rows are zero.

`aero-memory.benchmark.js` runs 17 declared transactional-memory scenarios. Aero
v0.2 passes 17/17; an intentionally simple append-only control passes 2/17. This
is an invariant control experiment, not a measurement of a named competitor and
not proof of general real-world memory quality.

```powershell
node aero-memory.test.js
node aero-memory.benchmark.js
```

## Next evidence gates

- natural-language conflict detection with a held-out false-conflict set;
- network interruption trials across prepare and commit response loss;
- real-device WebAuthn enrollment, explicit memory commit, and recovery UX;
- temporal question answering across longer histories;
- user studies measuring correction effort and harmful stale-memory rate;
- dependency extraction that never promotes an inferred edge without evidence.
