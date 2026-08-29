"""Aero's server-owned execution protocol.

The browser remains the presentation surface. This module owns the contract
digest, one-use authority tokens, deterministic state transition, encrypted
recovery snapshots, and the append-only evidence chain.
"""
from __future__ import annotations

import base64
import copy
import hashlib
import json
import re
import secrets
from datetime import datetime, timezone
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AeroRun, AeroRunEvent, utcnow

PROTOCOL_VERSION = "aero-server-v0.1"
SUPPORTED_ACTIONS = (
    "add_task",
    "complete_task",
    "add_note",
    "add_doc",
    "log_work",
    "add_goal",
    "add_education",
    "add_project",
)
CAPABILITIES = {
    "add_task": "lyfe.tasks.create",
    "complete_task": "lyfe.tasks.complete",
    "add_note": "lyfe.library.note.create",
    "add_doc": "lyfe.library.doc.create",
    "log_work": "lyfe.tracking.worklog.create",
    "add_goal": "lyfe.tracking.goal.create",
    "add_education": "lyfe.tracking.education.create",
    "add_project": "lyfe.projects.create",
}
ACCEPTANCE = {
    "add_task": "One matching open task exists.",
    "complete_task": "The single intended task is complete.",
    "add_note": "One matching note exists.",
    "add_doc": "One matching document exists.",
    "log_work": "One matching work-log entry exists.",
    "add_goal": "One matching active goal exists.",
    "add_education": "One matching learning item exists.",
    "add_project": "One matching active project exists.",
}
COLLECTIONS = ("tasks", "notes", "docs", "worklog", "goals", "education", "projects")
AREAS = ("Work", "Research", "Education", "Personal", "Health", "Other")
PRIORITIES = ("High", "Medium", "Low")
EDUCATION_KINDS = ("Course", "Degree", "Certification", "Language", "Book", "Paper", "Skill", "Other")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class ProtocolError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest_value(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def seal_json(key: bytes, value: Any, aad: str) -> str:
    nonce = secrets.token_bytes(12)
    plaintext = canonical_json(value).encode("utf-8")
    ciphertext = AESGCM(key).encrypt(nonce, plaintext, aad.encode("utf-8"))
    return _b64encode(nonce + ciphertext)


def open_json(key: bytes, value: str, aad: str) -> Any:
    try:
        packed = _b64decode(value)
        plaintext = AESGCM(key).decrypt(packed[:12], packed[12:], aad.encode("utf-8"))
        return json.loads(plaintext.decode("utf-8"))
    except Exception as error:
        raise ProtocolError("JOURNAL_DECRYPT_FAILED", "Encrypted Aero journal data could not be verified") from error


def normalize_contract(body: Any) -> dict[str, Any]:
    raw = body.model_dump(exclude_none=True) if hasattr(body, "model_dump") else dict(body)
    actions = []
    for action in raw.get("actions", []):
        clean = action.model_dump(exclude_none=True) if hasattr(action, "model_dump") else dict(action)
        if clean.get("type") not in SUPPORTED_ACTIONS:
            raise ProtocolError("CAPABILITY_DENIED", "This action is not available on the isolated server route")
        actions.append(clean)
    if not actions:
        raise ProtocolError("EMPTY_CONTRACT", "At least one executable action is required")
    return {
        "protocol": PROTOCOL_VERSION,
        "intent": str(raw.get("intent", "")).strip(),
        "actions": actions,
        "capabilities": [CAPABILITIES[action["type"]] for action in actions],
        "acceptance": [ACCEPTANCE[action["type"]] for action in actions],
        "route": "server-state-engine",
        "rollbackPolicy": "all-or-nothing",
        "budget": {"maxSteps": len(actions), "maxWallMs": 15_000, "maxExternalWrites": len(actions)},
    }


def contract_review(contract: dict[str, Any]) -> list[dict[str, str]]:
    review = []
    for index, action in enumerate(contract["actions"]):
        subject = action.get("title") or action.get("name") or action.get("text") or "item"
        review.append(
            {
                "stepId": f"step-{index + 1}",
                "type": action["type"],
                "subject": str(subject)[:180],
                "capability": CAPABILITIES[action["type"]],
                "acceptance": ACCEPTANCE[action["type"]],
            }
        )
    return review


def contract_aad(run: AeroRun) -> str:
    return f"aero-run:{run.id}:contract:{run.contract_digest}"


def snapshot_aad(run: AeroRun, kind: str, digest: str) -> str:
    return f"aero-run:{run.id}:{kind}:{digest}"


def decrypt_contract(run: AeroRun, key: bytes) -> dict[str, Any]:
    contract = open_json(key, run.contract_ciphertext, contract_aad(run))
    if digest_value(contract) != run.contract_digest:
        raise ProtocolError("CONTRACT_INTEGRITY_FAILED", "Stored contract digest does not match its encrypted payload")
    return contract


def normalize_snapshot(value: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    normalized: dict[str, list[dict[str, Any]]] = {}
    for name in COLLECTIONS:
        items = value.get(name, [])
        if not isinstance(items, list):
            raise ProtocolError("SNAPSHOT_INVALID", f"{name} must be a list")
        seen: set[str] = set()
        normalized[name] = []
        for item in items:
            if not isinstance(item, dict):
                raise ProtocolError("SNAPSHOT_INVALID", f"{name} contains a non-record value")
            item_id = str(item.get("id", "")).strip()
            if not item_id or item_id in seen:
                raise ProtocolError("SNAPSHOT_INVALID", f"{name} records need unique non-empty IDs")
            seen.add(item_id)
            normalized[name].append(copy.deepcopy(item))
    return normalized


def _valid_date(value: Any) -> str | None:
    text = str(value or "")
    return text if DATE_RE.fullmatch(text) else None


def _record_id(run_id: str, index: int, current: list[dict[str, Any]]) -> str:
    base = f"aero-{run_id}-{index + 1}"
    used = {str(item.get("id", "")) for item in current}
    candidate = base
    suffix = 1
    while candidate in used:
        suffix += 1
        candidate = f"{base}-{suffix}"
    return candidate


def _exact(left: Any, right: Any) -> bool:
    return str(left or "").strip().casefold() == str(right or "").strip().casefold()


def simulate_transition(
    snapshot: dict[str, Any], contract: dict[str, Any], run_id: str, at: datetime | None = None
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Produce deterministic patches and the exact target state for a contract."""
    target = normalize_snapshot(snapshot)
    patches: list[dict[str, Any]] = []
    moment = at or utcnow()
    at_ms = int(moment.replace(tzinfo=timezone.utc).timestamp() * 1000)
    today = moment.date().isoformat()

    for index, action in enumerate(contract["actions"]):
        action_type = action["type"]
        collection = ""
        record: dict[str, Any]
        operation = "insert"
        if action_type == "add_task":
            collection = "tasks"
            record = {
                "id": _record_id(run_id, index, target[collection]),
                "title": str(action["title"]).strip()[:200],
                "area": action.get("area") if action.get("area") in AREAS else "Personal",
                "priority": action.get("priority") if action.get("priority") in PRIORITIES else "Medium",
                "due": _valid_date(action.get("due")),
                "projectId": None,
                "notes": "",
                "status": "open",
                "createdAt": at_ms,
                "completedAt": None,
            }
            target[collection].append(record)
        elif action_type == "complete_task":
            collection = "tasks"
            query = str(action["title"]).strip().casefold()
            matches = [
                item for item in target[collection]
                if item.get("status") != "done"
                and (query in str(item.get("title", "")).casefold() or str(item.get("title", "")).casefold() in query)
            ]
            if len(matches) != 1:
                raise ProtocolError("TARGET_NOT_SINGULAR", "Completion requires exactly one matching open task")
            record = copy.deepcopy(matches[0])
            record["status"] = "done"
            record["completedAt"] = at_ms
            target[collection][target[collection].index(matches[0])] = record
            operation = "replace"
        elif action_type in ("add_note", "add_doc"):
            collection = "docs" if action_type == "add_doc" else "notes"
            body = str(action.get("body", "")).strip()
            title = str(action.get("title", "")).strip()[:120] or body[:48] or "Untitled"
            record = {
                "id": _record_id(run_id, index, target[collection]),
                "title": title,
                "body": body,
                "pinned": False,
                "createdAt": at_ms,
                "updatedAt": at_ms,
            }
            target[collection].insert(0, record)
        elif action_type == "log_work":
            collection = "worklog"
            hours = action.get("hours")
            record = {
                "id": _record_id(run_id, index, target[collection]),
                "date": _valid_date(action.get("date")) or today,
                "text": str(action["text"]).strip(),
                "hours": max(0, min(24, float(hours))) if hours is not None else None,
                "createdAt": at_ms,
            }
            target[collection].append(record)
        elif action_type == "add_goal":
            collection = "goals"
            record = {
                "id": _record_id(run_id, index, target[collection]),
                "title": str(action["title"]).strip()[:200],
                "why": str(action.get("why", "")).strip(),
                "horizon": _valid_date(action.get("horizon")),
                "status": "active",
                "milestones": [],
                "createdAt": at_ms,
            }
            target[collection].append(record)
        elif action_type == "add_education":
            collection = "education"
            record = {
                "id": _record_id(run_id, index, target[collection]),
                "title": str(action["title"]).strip()[:200],
                "provider": str(action.get("provider", "")).strip(),
                "kind": action.get("kind") if action.get("kind") in EDUCATION_KINDS else "Course",
                "status": "in-progress",
                "progress": 0,
                "startDate": None,
                "targetDate": None,
                "notes": "",
                "createdAt": at_ms,
            }
            target[collection].append(record)
        elif action_type == "add_project":
            collection = "projects"
            record = {
                "id": _record_id(run_id, index, target[collection]),
                "name": str(action.get("name") or action.get("title", "")).strip()[:160],
                "area": action.get("area") if action.get("area") in AREAS else "Work",
                "status": "active",
                "progress": 0,
                "targetDate": None,
                "description": str(action.get("description", "")).strip(),
                "createdAt": at_ms,
            }
            target[collection].append(record)
        else:
            raise ProtocolError("CAPABILITY_DENIED", "Unsupported action reached the state engine")

        patches.append(
            {
                "stepId": f"step-{index + 1}",
                "idempotencyKey": digest_value({"runId": run_id, "index": index, "action": action}),
                "op": operation,
                "collection": collection,
                "position": "start" if action_type in ("add_note", "add_doc") else "end",
                "record": record,
                "capability": CAPABILITIES[action_type],
                "acceptance": ACCEPTANCE[action_type],
            }
        )
    return target, patches


def _event_material(
    run_id: str,
    sequence: int,
    event_type: str,
    payload_digest: str,
    previous_digest: str,
    created_at: datetime,
) -> dict[str, Any]:
    return {
        "runId": run_id,
        "sequence": sequence,
        "type": event_type,
        "payloadDigest": payload_digest,
        "previousDigest": previous_digest,
        "createdAt": created_at.isoformat(timespec="microseconds") + "Z",
    }


def append_event(
    db: Session, run: AeroRun, key: bytes, event_type: str, payload: dict[str, Any]
) -> AeroRunEvent:
    sequence = run.event_sequence + 1
    created_at = utcnow()
    payload_digest = digest_value(payload)
    material = _event_material(run.id, sequence, event_type, payload_digest, run.event_head_digest, created_at)
    event_digest = digest_value(material)
    event = AeroRunEvent(
        run_id=run.id,
        sequence=sequence,
        event_type=event_type,
        payload_digest=payload_digest,
        previous_digest=run.event_head_digest,
        event_digest=event_digest,
        payload_ciphertext=seal_json(key, payload, f"aero-run:{run.id}:event:{sequence}:{event_digest}"),
        created_at=created_at,
    )
    db.add(event)
    run.event_sequence = sequence
    run.event_head_digest = event_digest
    run.updated_at = created_at
    return event


def verify_event_chain(db: Session, run: AeroRun, key: bytes) -> dict[str, Any]:
    events = list(
        db.scalars(select(AeroRunEvent).where(AeroRunEvent.run_id == run.id).order_by(AeroRunEvent.sequence))
    )
    previous = ""
    invalid: list[int | str] = []
    for expected_sequence, event in enumerate(events, 1):
        try:
            payload = open_json(
                key,
                event.payload_ciphertext,
                f"aero-run:{run.id}:event:{event.sequence}:{event.event_digest}",
            )
            payload_ok = digest_value(payload) == event.payload_digest
        except ProtocolError:
            payload_ok = False
        material = _event_material(
            run.id,
            event.sequence,
            event.event_type,
            event.payload_digest,
            event.previous_digest,
            event.created_at,
        )
        if (
            event.sequence != expected_sequence
            or event.previous_digest != previous
            or event.event_digest != digest_value(material)
            or not payload_ok
        ):
            invalid.append(event.sequence)
        previous = event.event_digest
    if run.event_sequence != len(events) or run.event_head_digest != previous:
        invalid.append("head")
    return {"valid": not invalid, "events": len(events), "headDigest": previous, "invalid": invalid}


def verify_run_payloads(run: AeroRun, key: bytes) -> dict[str, Any]:
    invalid: list[str] = []
    try:
        contract = open_json(key, run.contract_ciphertext, contract_aad(run))
        if digest_value(contract) != run.contract_digest:
            invalid.append("contract")
    except ProtocolError:
        invalid.append("contract")
    for kind, ciphertext, expected_digest in (
        ("before", run.before_ciphertext, run.before_digest),
        ("target", run.target_ciphertext, run.target_digest),
    ):
        if ciphertext is None and expected_digest is None:
            continue
        if not ciphertext or not expected_digest:
            invalid.append(kind)
            continue
        try:
            snapshot = open_json(key, ciphertext, snapshot_aad(run, kind, expected_digest))
            if digest_value(snapshot) != expected_digest:
                invalid.append(kind)
        except ProtocolError:
            invalid.append(kind)
    return {"valid": not invalid, "invalid": invalid}


def completion_certificate(run: AeroRun) -> dict[str, Any]:
    payload = {
        "protocol": PROTOCOL_VERSION,
        "runId": run.id,
        "status": run.status,
        "contractDigest": run.contract_digest,
        "beforeDigest": run.before_digest,
        "targetDigest": run.target_digest,
        "eventHeadDigest": run.event_head_digest,
        "recoveryCount": run.recovery_count,
    }
    return {"payload": payload, "digest": digest_value(payload)}


def run_view(db: Session, run: AeroRun, key: bytes) -> dict[str, Any]:
    chain = verify_event_chain(db, run, key)
    payloads = verify_run_payloads(run, key)
    return {
        "id": run.id,
        "requestId": run.request_id,
        "status": run.status,
        "contractDigest": run.contract_digest,
        "beforeDigest": run.before_digest,
        "targetDigest": run.target_digest,
        "certificateDigest": run.certificate_digest,
        "recoveryCount": run.recovery_count,
        "journal": chain,
        "payloads": payloads,
        "createdAt": run.created_at,
        "updatedAt": run.updated_at,
    }
