# Aero v0

Aero is the consumer personal-intelligence layer inside Lyfe. It is one product
name across Lyfe, Connect, the Sonne Systems website, sign-in, settings, and the
conversation surface.

EOS and EOS-F1 remain separate research programs. Aero is a clean-room product
implementation. It must not import confidential IISc material, unpublished
research code, private datasets, or claims that have not been publicly earned.

## Product promise

> With repeated successful use, a person should be able to say less without
> reducing first-pass intent accuracy.

The v0 is built to test that promise rather than claim general autonomy.

## Product and interface system

Lyfe retains its dynamic text, useful motion, heat map, Wander, Calm, Gmail,
Projects, Library, and Connect. The Y3K product system uses graphite navigation,
pearl content, electric cyan status, system typography, and short page
transitions. Material is reserved for navigation, commands, and approvals so
the content remains legible and calm.

Aero is available from the hero, global command, Gmail signals, Connect and the
dedicated Aero workspace. These entry points hand the active Lyfe source into
Aero so the person can use shorthand without turning Today into a generic AI
dashboard.

The Aero mark is a forward air signal inside a graphite field. It has no stars
or orbit ring. Lyfe, Connect, Aero, and Sonne each have a related but distinct
vector mark.

## Runtime architecture

```text
Today / Tracking / Library / Connect / Gmail / Profile
                         |
                  permission policy
                         |
                 bounded ContextPack
                         |
       epistemic governor -> model router -> response
                         |                    |
                    typed memory       action proposal
                         |                    |
               adaptation governor     preview / approve
                         |                    |
                 outcome telemetry       Lyfe ledger
```

### Context engine

`aero-core.js` creates a small context pack per turn. It contains the active
surface, a sanitized active object, enabled source summaries, source items, and
eligible memory. Disabling a source keeps it out of the prompt; it does not
delete the underlying Lyfe data.

Gmail contributes recent sender, subject, and snippet metadata only. Connect
contributes local conversations, activity, saved opportunities, and pins. The
device-only Knowledge vault can retrieve relevant passages from user-owned
ChatGPT/Gemini exports without placing those imports in Lyfe sync.

### Typed memory

- `episodic`: a past event or decision;
- `semantic`: a stable fact or preference;
- `project`: context scoped to a named project;
- `procedural`: a repeatable way the person does something.

Explicit memories are active because the user chose them. Inferred memory starts
as a visible candidate. Promotion requires at least three successful signals on
two distinct days with no failure. Corrections can dispute a promoted memory.

### Epistemic governor

The governor selects a mode before model routing:

- answer when the object and authority are clear;
- preview for direct external-action intent;
- clarify when a pronoun or target is ambiguous;
- refuse unsupported action types at validation time.

A task such as “remind me to email the professor” is internal task capture, not
authorization for Aero to send an email.

### Action engine

The v0 action allow-list is limited to reversible Lyfe changes: tasks, projects,
goals, learning, notes, documents, work logs, and explicit memory controls.
Every proposed change is rendered before application. External sends, payments,
publishing, and destructive external actions are not valid v0 action types.

### Durable harness

`aero-harness.js` keeps execution control outside the model loop. Its v0.4 run
contract provides:

- a SHA-256 contract digest that binds approval to intent, exact payload values,
  route, capability, acceptance criteria, budget, policy, and rollback mode;
- an allow-listed capability for each step and a denied state for unknown tools;
- hard step, retry, cloud-call, and duration budgets;
- immutable actions and a narrow fresh executor context for one step at a time;
- single-use, expiring approval and fresh approval for recovery;
- explicit task state updated only from independently audited facts;
- structured read-only evidence that the executor cannot self-certify;
- reverse compensation of every applied step when any later step fails;
- a distinct rollback-failed state when restoration cannot be proved;
- a completion certificate binding the exact contract to the evidence ledger;
- an event ledger and typed failure receipt for every run.

This design follows the strongest current result from long-horizon harness
research: separate task-state management, execution, and auditing. Aero applies
that pattern to personal work while adding exact approval binding and a consumer
review surface.

### Attention governor

Aero normally initiates at most one conversation message per day. A second is
allowed only for an urgent, distinct signal after a cooldown. Everything else
goes to Updates as quiet work notification. Brief, important-only, quiet, and
off modes are available in Settings.

### Model routing

The persistent product layer does not depend on one foundation model:

1. deterministic local tools always remain available;
2. Ollama can provide a local open-model adapter with structured output;
3. Groq GPT-OSS can answer cloud-safe prompts through an authenticated Edge
   Function that receives no Lyfe context, memory, Gmail, files, or chat history;
4. future GPT/Codex and Gemini adapters are optional specialists behind explicit,
   supported authorization rather than consumer-session scraping;
5. Inkling can become an optional multimodal/tool-use specialist behind a private
   endpoint or an explicitly approved hosted route;
6. a failed adapter falls back without bypassing the action validator.

ChatGPT Plus and Google AI Pro subscriptions are not assumed to provide developer
API credit. Every route records the engine that actually answered, and private
signals stay local unless a future connection is explicitly allowed for that task.

#### Inkling decision (August 2026)

Thinking Machines Lab's [Inkling-Small model card](https://thinkingmachines.ai/model-card/inkling-small/)
makes it a strong Aero candidate: Apache-2.0 weights, native text/image/audio
input, agentic tool use, controllable reasoning effort, calibrated forecasting,
and up to a 1M-token context window. Those qualities fit a specialist that can
inspect mixed media, plan tool calls, or help generate evaluated customization
data.

It is not Aero's free desktop default. Inkling-Small has 276B total parameters
(12B active), and its official NVFP4 deployment still requires at least 180 GB
of aggregate VRAM. [Tinker pricing](https://tinker-docs.thinkingmachines.ai/tinker/models/)
also makes hosted inference and training a paid route. Aero therefore keeps the
built-in/Ollama path as its free core and treats Inkling as a capability-gated
adapter. Its self-customization ideas influence the evaluation loop, but no
personal history is used for fine-tuning without explicit consent and a held-out
evaluation gate.

### Knowledge import

`aero-knowledge.js` parses user-selected ChatGPT exports, Gemini Takeout files,
and plain text or Markdown. Each record carries its source and title, is scoped
to the active Lyfe account on that browser, and can be cleared independently.
Retrieval is bounded and query-driven; importing history does not silently turn
every old chat into a permanent personal fact.

## Evaluation and training policy

The dashboard records:

- rated outcomes;
- first-pass intent rate;
- words used on successful turns;
- matched repeat comparisons;
- communication compression relative to the person's first successful example
  for the same outcome family;
- memory promotions and false promotions.

One success establishes a baseline and cannot prove compression. The v0 evidence
gate requires at least ten rated outcomes, five matched repeats, at least 85%
first-pass intent, and no more than 5% false promotions.

No training happens silently. The manual JSONL export is disabled by default,
requires consent, redacts email addresses and phone numbers, and includes only
turns explicitly rated helpful. Applying an action alone does not place a turn in
the training export.

Run the clean-room behavioral checks:

```powershell
node aero-core.test.js
node aero-harness.test.js
node aero-harness.benchmark.js
node cloud.test.js
```

## Current v0 limit

This release proves the governed product loop, not a frontier base model. It can
reason through an optional model adapter and operate on the existing Lyfe
substrate, but it does not send messages, browse arbitrary sites, spend money,
or autonomously install skills. Those capabilities require a server-side
authority layer, adversarial evaluation, verified execution receipts, and a
separate user decision.
