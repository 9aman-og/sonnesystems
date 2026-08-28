# Aero harness architecture and evaluation

## North star

Aero should let one person say less over time without reducing first-pass intent
accuracy or quietly increasing risk.

That is a harder target than building a capable chat loop. The product must
learn useful compression, preserve source boundaries, choose the right model,
complete work reliably, and keep authority with the person.

## What the frontier already does well

| System | Strongest useful idea | Gap Aero must close |
| --- | --- | --- |
| OpenClaw | A low-level executor with tool and authentication policy around it | Execution does not by itself prove long-term personalization or communication compression |
| Hermes Agent | Open skills, tool use, provider flexibility, and persistent learning | Learned behavior still needs explicit promotion, decay, dispute, and outcome governance |
| LangGraph | Durable checkpoints, interrupts, replay, and human review | Infrastructure primitives do not decide what is worth remembering or how much a person should need to repeat |
| OpenAI Agents SDK | Typed tools, guardrails, handoffs, traces, and approvals | The application still owns authority policy, memory quality, and end-to-end product evaluation |
| OpenRouter | Broad model access and routing | It is a model gateway, not a personal context, memory, authority, or verified-action harness |
| LongHorizon-Harness | Manager, fresh-context executor, and independent auditor | Strong task completion needs a consumer authority model and long-term adaptation layer |

Primary references:

- [OpenClaw harness](https://docs.openclaw.ai/concepts/agent-loop)
- [Hermes Agent](https://github.com/NousResearch/hermes-agent)
- [LangGraph durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution)
- [LangGraph human review](https://docs.langchain.com/oss/python/langchain/human-in-the-loop)
- [OpenAI Agents SDK guardrails](https://openai.github.io/openai-agents-python/guardrails/)
- [LongHorizon-Harness](https://arxiv.org/html/2608.01964)
- [Prompt-injection-resistant agent design](https://arxiv.org/html/2506.08837)

## Aero system

    request
      |
      v
    permissioned context pack
      |
      +--> epistemic governor --> clarify / answer / propose / refuse
      |                               |
      |                               v
      |                         model router
      |                    local / cloud specialist
      |                               |
      +--> typed memory <-------------+
      |     episodic / semantic / project / procedural
      |                               |
      v                               v
    adaptation governor          immutable action plan
                                      |
                                      v
                             exact user approval
                                      |
                                      v
                     manage -> execute -> audit -> checkpoint
                                      |
                        +-------------+-------------+
                        |                           |
                     verified                 failed audit
                        |                           |
                   next step       reverse-compensate every write
                        |                           |
                        v                           v
              evidence certificate          atomic abort

The model may suggest. It never grants itself authority, expands its own
capabilities, or certifies that its own work succeeded.

## v0.4 execution invariants

1. Every action type is allow-listed.
2. Every concrete payload value is checked against the local action schema.
3. Every step has one narrow capability, route, risk class, and acceptance condition.
4. SHA-256 binds approval to intent, exact values, capability, route, acceptance,
   budget, idempotency keys, policy version, and rollback mode.
5. Approval expires after 30 minutes and is consumed once.
6. The executor receives one immutable action and a narrow fresh context.
7. A separate read-only auditor must return structured environment evidence.
8. Self-reported success and evidence-free success fail closed.
9. A later failure compensates every applied step in reverse order.
10. Compensation failure is surfaced as a distinct critical state; it is never
    reported as a clean rollback.
11. Only current, verified audit evidence can cross the transaction boundary.
12. Completion requires a tamper-evident certificate binding the action contract,
    evidence ledger, and full step coverage.
13. A failed run can retry only after a clean rollback and fresh user approval.
14. Unknown actions, fields, routes, capabilities, authority states, or budget
    changes fail closed.

## What the 2026 evidence changed

The v0.4 design is a direct response to several recent results:

- [LongHorizon-Harness](https://arxiv.org/html/2608.01964) shows large gains from
  explicit state, fresh-context execution, and an independent read-only auditor.
- [StructAgent](https://arxiv.org/html/2607.11388v1) strengthens that pattern with
  verifier-backed state transitions, checkpoints, and targeted recovery.
- [Cordon](https://arxiv.org/html/2606.17573v1) and
  [Agentic Transaction](https://arxiv.org/html/2608.13900v1) show why per-call
  guardrails are insufficient: multi-step work needs a semantic commit boundary,
  staged effects, lineage, and all-or-nothing recovery.
- [Evidence-Carrying Termination](https://arxiv.org/html/2608.23623) motivates a
  typed completion certificate in which every completion claim is bound to
  in-scope trace evidence.
- Microsoft's [action-bound approval protocol](https://microsoft.github.io/agent-governance-toolkit/adr/0030-action-bound-approval-protocol/)
  binds consent to the exact canonical request, expiry, subject, target, and
  operation, then revalidates immediately before execution.
- [Capability Gates Are Not Authorization](https://arxiv.org/html/2606.28679)
  explains why exposing a tool cannot authorize its concrete argument values.
- [STALE](https://arxiv.org/html/2605.06527) and
  [MemTxn](https://arxiv.org/html/2607.27834) identify the next memory frontier:
  conflict-aware commits, cascading invalidation, version resolution, and
  application-visible recovery.
- [EOPA](https://arxiv.org/html/2608.04416v1) supports evidence-driven online
  preference adaptation without retraining; [PAUSE](https://arxiv.org/html/2607.27354v1)
  demonstrates that stateful personal-assistant behavior remains difficult even
  for leading proprietary systems.

## Deterministic invariant benchmark

`aero-harness.benchmark.js` executes 18 adversarial scenarios across approval
binding, tool security, verification, recovery, and termination. On the current
release, Aero v0.4 passes 18/18. An intentionally minimal direct model-to-tool
loop passes 0/18 because it has none of these controls.

This is a harness control experiment, not a benchmark of OpenClaw, Hermes, or
any other third-party system. It proves that the implementation enforces its
declared local invariants. It does not prove better real-world task performance.

Run it with:

```powershell
node aero-harness.test.js
node aero-harness.benchmark.js
```

## Memory governance

Memory is a controlled data product, not an ever-growing transcript.

| Type | Stores | Promotion rule | Decay rule |
| --- | --- | --- | --- |
| Episodic | What happened in one bounded event | Explicit event or verified outcome | Compress after the retrieval horizon |
| Semantic | Stable fact or preference | Explicit statement or repeated verified evidence | Recheck when contradicted |
| Project | Decisions, constraints, and evidence for one project | Verified project outcome or explicit save | Archive with the project |
| Procedural | A repeatable way the person works | At least three successes across two days, with no failure | Demote after correction, contradiction, or sustained non-use |

Every memory keeps source, confidence, timestamps, scope, evidence, and dispute
state. Imported chats remain retrievable knowledge and do not silently become
personal facts.

## Model routing

Routing optimizes for the smallest sufficient capability:

1. Deterministic local functions for direct Lyfe operations.
2. Local open models for private general reasoning when available.
3. A free-tier cloud route for prompts that contain no private Lyfe context.
4. Optional paid or specialist routes only after explicit connection and policy.
5. Fallback to a smaller or local route without bypassing the action validator.

The router records the engine that actually answered, latency, failure, and why
the route was eligible. Subscriptions such as ChatGPT Plus and Google AI Pro are
not treated as developer API credit.

## Evaluation scorecard

No single benchmark can establish that Aero is the best harness. Release claims
require this scorecard across repeated trials.

| Dimension | Metric | v0 evidence gate |
| --- | --- | --- |
| Intent | First-pass intent accuracy | At least 85% across 10 rated outcomes |
| Compression | Words for matched successful outcomes | Improvement across at least 5 repeated outcome families |
| Completion | Environment-verified acceptance conditions | 100% of reported completed steps audited |
| False finish | Agent says done while a verifier fails | 0 in the release suite |
| Authority | Unapproved or tampered plans executed | 0 across adversarial trials |
| Replay | Duplicate side effects after resume | 0 across crash and retry trials |
| Memory | False promotion rate | At most 5% |
| Recovery | Failed audit compensated and downstream work stopped | 100% in supported reversible actions |
| Initiative | Unrequested conversation messages | 1 normally, 2 only for distinct urgency |
| Cost | Paid calls without explicit opt-in | 0 |
| Accessibility | Keyboard, focus, target, contrast, and reduced motion checks | All release-critical checks pass |

For long-horizon work, add WeaveBench, Terminal-Bench, OSWorld, and a Lyfe-native
suite of real personal workflows. Use programmatic environment graders when
possible, at least three repeats, full event traces, partial progress, time,
tokens, retries, corrections, and compensation rate.

## Clean-room rule

Aero is a Sonne Systems consumer product. EOS and EOS-F1 remain separate
research lineage. Aero must not import confidential IISc code, datasets,
documents, unpublished methods, evaluation results, or internal claims.

## Honest current state

The current build proves the bounded personal action loop in the browser and
connects it to Lyfe context, typed memory, projects, Gmail metadata, model
routing, and communication-compression telemetry. It does not yet prove
world-leading long-horizon benchmark performance. The auditor and compensator
still share one browser process, and rollback tokens are not yet journaled into
a server-owned crash-recovery store. Arbitrary external tools are not enabled.
The next evidence gates are process-isolated auditing, durable cross-restart
recovery, stale-memory dependency invalidation, and repeated Lyfe-native tasks
with environment graders. The architecture and tests are designed so stronger
claims can be earned rather than declared.
