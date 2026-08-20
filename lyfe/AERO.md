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

## Today is the attention layer

Today is intentionally not a feed and not a catalogue of every Lyfe feature.
Its stable hierarchy is:

1. an Aero brief derived from the enabled context sources;
2. at most five ranked commitments;
3. shorthand commands that hand the current source into Aero;
4. read-only Gmail signals;
5. durable state from Tracking, Library, and Connect.

The old decorative planet/blob, gamification dashboard, heat map, full Wander
experience, random calm image, repeated Connect cards, and duplicated project
summaries were removed from Today. Those elements made the page expressive but
obscured the human decision. Gamification data remains in the product ledger,
and the underlying Wander route is not deleted, but neither competes with the
attention surface.

The Aero mark in Today is a fixed logo and context-status card, not a decorative
character. It shows which sources are actually available and never implies that
Gmail is connected before Gmail data is present.

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
contributes local conversations, activity, saved opportunities, and pins. Cloud
models receive enabled Lyfe context only when the separate cloud-context switch
is on.

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

### Model routing

The persistent product layer does not depend on one foundation model:

1. deterministic local tools always remain available;
2. Ollama can provide a local open-model adapter with structured output;
3. Anthropic can be selected with a user-supplied key;
4. a failed adapter falls back without bypassing the action validator.

The API key is device-local. A cloud adapter may receive the conversation while
Lyfe context remains disabled.

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
```

## Current v0 limit

This release proves the governed product loop, not a frontier base model. It can
reason through an optional model adapter and operate on the existing Lyfe
substrate, but it does not send messages, browse arbitrary sites, spend money,
or autonomously install skills. Those capabilities require a server-side
authority layer, adversarial evaluation, verified execution receipts, and a
separate user decision.
