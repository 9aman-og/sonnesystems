# Aero v0: adaptive personal intelligence

This is a functional, local product slice for Aero inside the existing Lyfe product. Open `index.html` through a local web server.

## What works

- Lyfe surface switching across Today, Aero, Connect, Tracking, Library, and Gmail.
- Global context changes with the active surface and exposes its selection rationale.
- Short requests such as “follow up,” “compare these,” and “same as last time.”
- One-question clarification when a short instruction has multiple plausible targets.
- Draft-only and reversible action proposals, explicit approval, and Undo.
- Typed project, semantic, and procedural memories with a quarantined candidate state.
- Inspect, approve, and forget controls for memory.
- Local event trace and communication-compression metrics stored in browser `localStorage`.
- Responsive graphite and pearl product system with a scalable Aero identity.

## Important limitation

This public surface uses representative data. “Open my Aero” hands the active surface and draft prompt into the authenticated Lyfe workspace; private account data, Gmail, and actions stay inside Lyfe. Nothing external is sent automatically.

## Consumer and research naming

The consumer product is **Aero**. EOS and EOS-F1 remain separate Sonne Systems research lineage and are not edited by this product build. No confidential IISc material, code, model, dataset, or unpublished method is used in Aero.
