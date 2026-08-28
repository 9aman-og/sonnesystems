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
                   next step              compensate and stop

The model may suggest. It never grants itself authority, expands its own
capabilities, or certifies that its own work succeeded.

## v0.3 execution invariants

1. Every action type is allow-listed.
2. Every step has one narrow capability and one acceptance condition.
3. Approval is bound to the canonical digest of the complete nested plan.
4. Approval expires after 30 minutes.
5. The executor receives one action and a narrow fresh context.
6. Completed idempotency keys cannot replay.
7. Only the auditor can add a verified fact to durable task state.
8. A failed audit invokes compensation and stops downstream execution.
9. Unknown tools, routes, capabilities, or authority states fail closed.
10. Runs have fixed step, retry, cloud-call, and wall-time budgets.

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
world-leading long-horizon benchmark performance. The architecture and tests
are designed so that claim can be earned rather than declared.
