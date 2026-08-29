"""Adversarial checks for Aero's server-owned authority and recovery boundary."""
from __future__ import annotations

import copy
import itertools
from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError
from fastapi.testclient import TestClient

from app import config, security
from app.db import get_engine
from app.main import create_app
from app.models import AeroRun, AeroRunEvent, utcnow

_USERS = itertools.count(1)


def _auth(client) -> dict[str, str]:
    number = next(_USERS)
    email = f"aero-run-{number}@example.com"
    password = "correct-horse-battery"
    assert client.post("/auth/register", json={"email": email, "password": password}).status_code == 201
    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['token']}"}


def _snapshot(**overrides) -> dict:
    value = {
        "tasks": [],
        "notes": [],
        "docs": [],
        "worklog": [],
        "goals": [],
        "education": [],
        "projects": [],
    }
    value.update(overrides)
    return value


def _prepare(client, headers, request_id="aero-request-001", actions=None):
    actions = actions or [{"type": "add_task", "title": "Private launch task", "priority": "High"}]
    response = client.post(
        "/aero/runs",
        headers=headers,
        json={"requestId": request_id, "intent": "Prepare my launch work", "actions": actions},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _approve(client, headers, run):
    response = client.post(
        f"/aero/runs/{run['id']}/approve",
        headers=headers,
        json={"contractDigest": run["contractDigest"]},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _lease(client, headers, run, approval, before=None):
    response = client.post(
        f"/aero/runs/{run['id']}/lease",
        headers=headers,
        json={
            "contractDigest": run["contractDigest"],
            "approvalToken": approval["approvalToken"],
            "beforeSnapshot": before or _snapshot(),
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _apply_patches(before: dict, patches: list[dict]) -> dict:
    after = copy.deepcopy(before)
    for patch in patches:
        collection = after[patch["collection"]]
        record = copy.deepcopy(patch["record"])
        if patch["op"] == "insert":
            collection.insert(0, record) if patch["position"] == "start" else collection.append(record)
        elif patch["op"] == "replace":
            index = next(i for i, item in enumerate(collection) if item["id"] == record["id"])
            collection[index] = record
        else:
            raise AssertionError(f"unknown patch operation {patch['op']}")
    return after


def _code(response) -> str:
    return response.json()["detail"]["code"]


def _tamper_ciphertext(value: str) -> str:
    """Change authenticated bytes, not optional base64url padding bits."""
    index = max(16, len(value) // 2)
    replacement = "A" if value[index] != "A" else "B"
    return value[:index] + replacement + value[index + 1 :]


def test_server_owned_happy_path_is_atomic_private_and_replay_safe(client):
    headers = _auth(client)
    actions = [
        {"type": "add_task", "title": "Private launch task", "priority": "High"},
        {"type": "add_note", "title": "Private memo", "body": "The private launch direction"},
    ]
    run = _prepare(client, headers, actions=actions)
    assert run["status"] == "prepared"
    assert run["journal"] == {"valid": True, "events": 1, "headDigest": run["journal"]["headDigest"], "invalid": []}
    assert [step["capability"] for step in run["review"]] == [
        "lyfe.tasks.create",
        "lyfe.library.note.create",
    ]

    wrong = client.post(
        f"/aero/runs/{run['id']}/approve",
        headers=headers,
        json={"contractDigest": "0" * 64},
    )
    assert wrong.status_code == 409
    assert _code(wrong) == "CONTRACT_CHANGED"

    approval = _approve(client, headers, run)
    raw_approval = approval["approvalToken"]
    with Session(get_engine()) as db:
        stored = db.get(AeroRun, run["id"])
        assert stored.approval_token_hash == security.hash_token(raw_approval)
        assert raw_approval not in stored.contract_ciphertext
        assert "Private launch task" not in stored.contract_ciphertext
        assert "The private launch direction" not in stored.contract_ciphertext

    before = _snapshot()
    lease = _lease(client, headers, run, approval, before)
    assert lease["status"] == "leased"
    assert len(lease["patches"]) == 2
    assert len({patch["idempotencyKey"] for patch in lease["patches"]}) == 2
    assert lease["patches"][1]["position"] == "start"
    after = _apply_patches(before, lease["patches"])

    replay = client.post(
        f"/aero/runs/{run['id']}/lease",
        headers=headers,
        json={
            "contractDigest": run["contractDigest"],
            "approvalToken": raw_approval,
            "beforeSnapshot": before,
        },
    )
    assert replay.status_code == 409
    assert _code(replay) == "RUN_NOT_APPROVED"

    attested = client.post(
        f"/aero/runs/{run['id']}/attest",
        headers=headers,
        json={
            "contractDigest": run["contractDigest"],
            "leaseToken": lease["leaseToken"],
            "afterSnapshot": after,
        },
    )
    assert attested.status_code == 200, attested.text
    certificate = attested.json()
    assert certificate["payload"]["status"] == "completed"
    assert certificate["digest"]
    assert certificate["journal"]["valid"] is True
    assert certificate["journal"]["events"] == 4

    visible = client.get(f"/aero/runs/{run['id']}", headers=headers)
    assert visible.status_code == 200
    assert visible.json()["status"] == "completed"
    assert visible.json()["certificateDigest"] == certificate["digest"]

    forbidden_recovery = client.post(
        f"/aero/runs/{run['id']}/recover",
        headers=headers,
        json={"contractDigest": run["contractDigest"]},
    )
    assert forbidden_recovery.status_code == 409
    assert _code(forbidden_recovery) == "RECOVERY_NOT_ALLOWED"

    with Session(get_engine()) as db:
        stored = db.get(AeroRun, run["id"])
        assert stored.approval_token_hash is None
        assert stored.lease_token_hash is None
        assert "Private launch task" not in stored.target_ciphertext
        assert "The private launch direction" not in stored.target_ciphertext


def test_prepare_is_idempotent_but_never_rebinds_a_request_id(client):
    headers = _auth(client)
    payload = {
        "requestId": "stable-request-001",
        "intent": "Create one task",
        "actions": [{"type": "add_task", "title": "Same task"}],
    }
    first = client.post("/aero/runs", headers=headers, json=payload)
    second = client.post("/aero/runs", headers=headers, json=payload)
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert second.json()["idempotent"] is True

    changed = copy.deepcopy(payload)
    changed["actions"][0]["title"] = "Mutated task"
    conflict = client.post("/aero/runs", headers=headers, json=changed)
    assert conflict.status_code == 409
    assert _code(conflict) == "IDEMPOTENCY_CONFLICT"


def test_attestation_mismatch_enters_durable_recovery_and_needs_exact_restore(client):
    headers = _auth(client)
    run = _prepare(
        client,
        headers,
        request_id="recovery-request-001",
        actions=[{"type": "add_project", "name": "Recovery project", "area": "Research"}],
    )
    approval = _approve(client, headers, run)
    before = _snapshot(tasks=[{"id": "t1", "title": "Existing", "status": "open"}])
    lease = _lease(client, headers, run, approval, before)

    mismatch = client.post(
        f"/aero/runs/{run['id']}/attest",
        headers=headers,
        json={
            "contractDigest": run["contractDigest"],
            "leaseToken": lease["leaseToken"],
            "afterSnapshot": before,
        },
    )
    assert mismatch.status_code == 409
    assert _code(mismatch) == "POSTCONDITION_MISMATCH"

    recovery = client.post(
        f"/aero/runs/{run['id']}/recover",
        headers=headers,
        json={"contractDigest": run["contractDigest"]},
    )
    assert recovery.status_code == 200, recovery.text
    recovery_body = recovery.json()
    assert recovery_body["beforeSnapshot"] == before

    wrong_restore = copy.deepcopy(before)
    wrong_restore["tasks"][0]["status"] = "done"
    rejected = client.post(
        f"/aero/runs/{run['id']}/recover/confirm",
        headers=headers,
        json={
            "contractDigest": run["contractDigest"],
            "recoveryToken": recovery_body["recoveryToken"],
            "restoredSnapshot": wrong_restore,
        },
    )
    assert rejected.status_code == 409
    assert _code(rejected) == "RECOVERY_MISMATCH"

    confirmed = client.post(
        f"/aero/runs/{run['id']}/recover/confirm",
        headers=headers,
        json={
            "contractDigest": run["contractDigest"],
            "recoveryToken": recovery_body["recoveryToken"],
            "restoredSnapshot": before,
        },
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["payload"]["status"] == "recovered"
    assert confirmed.json()["payload"]["recoveryCount"] == 1
    assert confirmed.json()["journal"]["valid"] is True

    replay = client.post(
        f"/aero/runs/{run['id']}/recover/confirm",
        headers=headers,
        json={
            "contractDigest": run["contractDigest"],
            "recoveryToken": recovery_body["recoveryToken"],
            "restoredSnapshot": before,
        },
    )
    assert replay.status_code == 409
    assert _code(replay) == "RUN_NOT_RECOVERING"


def test_completion_target_must_be_singular_and_contract_schema_is_closed(client):
    headers = _auth(client)
    run = _prepare(
        client,
        headers,
        request_id="singular-request-001",
        actions=[{"type": "complete_task", "title": "Launch"}],
    )
    approval = _approve(client, headers, run)
    ambiguous = _snapshot(
        tasks=[
            {"id": "a", "title": "Launch draft", "status": "open"},
            {"id": "b", "title": "Launch page", "status": "open"},
        ]
    )
    denied = client.post(
        f"/aero/runs/{run['id']}/lease",
        headers=headers,
        json={
            "contractDigest": run["contractDigest"],
            "approvalToken": approval["approvalToken"],
            "beforeSnapshot": ambiguous,
        },
    )
    assert denied.status_code == 409
    assert _code(denied) == "TARGET_NOT_SINGULAR"

    duplicate_ids = _snapshot(
        tasks=[
            {"id": "same", "title": "Launch", "status": "open"},
            {"id": "same", "title": "Other", "status": "open"},
        ]
    )
    invalid_snapshot = client.post(
        f"/aero/runs/{run['id']}/lease",
        headers=headers,
        json={
            "contractDigest": run["contractDigest"],
            "approvalToken": approval["approvalToken"],
            "beforeSnapshot": duplicate_ids,
        },
    )
    assert invalid_snapshot.status_code == 409
    assert _code(invalid_snapshot) == "SNAPSHOT_INVALID"

    unsupported = client.post(
        "/aero/runs",
        headers=headers,
        json={
            "requestId": "closed-schema-001",
            "intent": "Do an unsupported thing",
            "actions": [{"type": "memory_upsert", "claim": "secret"}],
        },
    )
    assert unsupported.status_code == 422
    unknown_field = client.post(
        "/aero/runs",
        headers=headers,
        json={
            "requestId": "closed-schema-002",
            "intent": "Try payload smuggling",
            "actions": [{"type": "add_task", "title": "Safe", "shell": "calc.exe"}],
        },
    )
    assert unknown_field.status_code == 422


def test_runs_are_private_and_journal_corruption_fails_closed(client):
    owner = _auth(client)
    other = _auth(client)
    run = _prepare(client, owner, request_id="private-run-001")
    assert client.get(f"/aero/runs/{run['id']}", headers=other).status_code == 404
    assert client.get(f"/aero/runs/{run['id']}").status_code == 401

    with Session(get_engine()) as db:
        event = db.scalar(select(AeroRunEvent).where(AeroRunEvent.run_id == run["id"]))
        event.payload_ciphertext = _tamper_ciphertext(event.payload_ciphertext)
        db.commit()

    visible = client.get(f"/aero/runs/{run['id']}", headers=owner)
    assert visible.status_code == 200
    assert visible.json()["journal"]["valid"] is False
    denied = client.post(
        f"/aero/runs/{run['id']}/approve",
        headers=owner,
        json={"contractDigest": run["contractDigest"]},
    )
    assert denied.status_code == 500
    assert _code(denied) == "JOURNAL_INTEGRITY_FAILED"

    contract_run = _prepare(client, owner, request_id="contract-corruption-001")
    with Session(get_engine()) as db:
        stored = db.get(AeroRun, contract_run["id"])
        stored.contract_ciphertext = _tamper_ciphertext(stored.contract_ciphertext)
        db.commit()
    denied_contract = client.post(
        f"/aero/runs/{contract_run['id']}/approve",
        headers=owner,
        json={"contractDigest": contract_run["contractDigest"]},
    )
    assert denied_contract.status_code == 500
    assert _code(denied_contract) == "RUN_PAYLOAD_INTEGRITY_FAILED"

    target_run = _prepare(client, owner, request_id="target-corruption-001")
    target_approval = _approve(client, owner, target_run)
    target_lease = _lease(client, owner, target_run, target_approval)
    with Session(get_engine()) as db:
        stored = db.get(AeroRun, target_run["id"])
        stored.target_ciphertext = _tamper_ciphertext(stored.target_ciphertext)
        db.commit()
    denied_attestation = client.post(
        f"/aero/runs/{target_run['id']}/attest",
        headers=owner,
        json={
            "contractDigest": target_run["contractDigest"],
            "leaseToken": target_lease["leaseToken"],
            "afterSnapshot": _apply_patches(_snapshot(), target_lease["patches"]),
        },
    )
    assert denied_attestation.status_code == 500
    assert _code(denied_attestation) == "RUN_PAYLOAD_INTEGRITY_FAILED"


def test_expired_authority_returns_to_a_recoverable_state(client):
    headers = _auth(client)
    run = _prepare(client, headers, request_id="expiry-run-001")
    approval = _approve(client, headers, run)
    with Session(get_engine()) as db:
        stored = db.get(AeroRun, run["id"])
        stored.approval_expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    expired = client.post(
        f"/aero/runs/{run['id']}/lease",
        headers=headers,
        json={
            "contractDigest": run["contractDigest"],
            "approvalToken": approval["approvalToken"],
            "beforeSnapshot": _snapshot(),
        },
    )
    assert expired.status_code == 409
    assert _code(expired) == "APPROVAL_EXPIRED"
    assert client.get(f"/aero/runs/{run['id']}", headers=headers).json()["status"] == "prepared"
    fresh_approval = _approve(client, headers, run)
    lease = _lease(client, headers, run, fresh_approval)
    recovery = client.post(
        f"/aero/runs/{run['id']}/recover",
        headers=headers,
        json={"contractDigest": run["contractDigest"]},
    ).json()
    with Session(get_engine()) as db:
        stored = db.get(AeroRun, run["id"])
        stored.recovery_expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    expired_recovery = client.post(
        f"/aero/runs/{run['id']}/recover/confirm",
        headers=headers,
        json={
            "contractDigest": run["contractDigest"],
            "recoveryToken": recovery["recoveryToken"],
            "restoredSnapshot": _snapshot(),
        },
    )
    assert expired_recovery.status_code == 409
    assert _code(expired_recovery) == "RECOVERY_EXPIRED"
    status_after = client.get(f"/aero/runs/{run['id']}", headers=headers).json()
    assert status_after["status"] == "recovery_required"
    assert status_after["journal"]["valid"] is True
    renewed = client.post(
        f"/aero/runs/{run['id']}/recover",
        headers=headers,
        json={"contractDigest": run["contractDigest"]},
    )
    assert renewed.status_code == 200
    assert renewed.json()["recoveryToken"] != recovery["recoveryToken"]
    assert lease["beforeDigest"] == renewed.json()["beforeDigest"]


def test_crash_recovery_survives_app_restart_and_user_can_erase_run(client):
    headers = _auth(client)
    run = _prepare(
        client,
        headers,
        request_id="restart-run-001",
        actions=[{"type": "add_goal", "title": "Restart-safe goal"}],
    )
    approval = _approve(client, headers, run)
    before = _snapshot(notes=[{"id": "n1", "title": "Existing", "body": "Kept"}])
    _lease(client, headers, run, approval, before)

    with TestClient(create_app()) as restarted:
        visible = restarted.get(f"/aero/runs/{run['id']}", headers=headers)
        assert visible.status_code == 200
        assert visible.json()["status"] == "leased"
        assert visible.json()["journal"]["valid"] is True
        recovery = restarted.post(
            f"/aero/runs/{run['id']}/recover",
            headers=headers,
            json={"contractDigest": run["contractDigest"]},
        )
        assert recovery.status_code == 200
        assert recovery.json()["beforeSnapshot"] == before
        confirmed = restarted.post(
            f"/aero/runs/{run['id']}/recover/confirm",
            headers=headers,
            json={
                "contractDigest": run["contractDigest"],
                "recoveryToken": recovery.json()["recoveryToken"],
                "restoredSnapshot": before,
            },
        )
        assert confirmed.status_code == 200
        assert confirmed.json()["payload"]["status"] == "recovered"

        forgotten = restarted.post(
            f"/aero/runs/{run['id']}/forget",
            headers=headers,
            json={"contractDigest": run["contractDigest"]},
        )
        assert forgotten.status_code == 204
        assert restarted.get(f"/aero/runs/{run['id']}", headers=headers).status_code == 404

    with Session(get_engine()) as db:
        assert db.get(AeroRun, run["id"]) is None
        assert list(db.scalars(select(AeroRunEvent).where(AeroRunEvent.run_id == run["id"]))) == []


def test_aero_route_fails_closed_without_an_encryption_key(client, monkeypatch):
    headers = _auth(client)
    monkeypatch.setattr(config, "aero_journal_key", lambda: None)
    disabled = client.post(
        "/aero/runs",
        headers=headers,
        json={
            "requestId": "disabled-route-001",
            "intent": "Do not store this without encryption",
            "actions": [{"type": "add_task", "title": "Never plaintext"}],
        },
    )
    assert disabled.status_code == 503
    assert _code(disabled) == "AERO_JOURNAL_DISABLED"


def test_run_rows_use_optimistic_concurrency_to_reject_lost_updates(client):
    headers = _auth(client)
    run = _prepare(client, headers, request_id="concurrency-run-001")
    first = Session(get_engine())
    second = Session(get_engine())
    try:
        left = first.get(AeroRun, run["id"])
        right = second.get(AeroRun, run["id"])
        left.recovery_count = 1
        first.commit()
        right.recovery_count = 2
        with pytest.raises(StaleDataError):
            second.commit()
        second.rollback()
    finally:
        first.close()
        second.close()
