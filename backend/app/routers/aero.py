"""Authenticated, server-owned execution and recovery boundary for Aero."""
from __future__ import annotations

import hmac
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from .. import aero_protocol as protocol
from .. import config, security
from ..db import get_db
from ..models import AeroRun, AeroRunEvent, AuthToken, User, utcnow
from ..schemas import (
    AeroApproveIn,
    AeroAttestIn,
    AeroForgetRunIn,
    AeroLeaseIn,
    AeroRecoverConfirmIn,
    AeroRecoverIn,
    AeroRunPrepareIn,
)
from .auth import current_user

router = APIRouter(prefix="/aero/runs", tags=["aero"])


def _problem(code: str, message: str, http_status: int = 409) -> HTTPException:
    return HTTPException(http_status, {"code": code, "message": message})


def _key() -> bytes:
    key = config.aero_journal_key()
    if key is None:
        raise _problem(
            "AERO_JOURNAL_DISABLED",
            "The encrypted Aero journal is not configured on this server",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return key


def _owned_run(db: Session, user: User, run_id: str) -> AeroRun:
    run = db.scalar(select(AeroRun).where(AeroRun.id == run_id, AeroRun.user_id == user.id))
    if run is None:
        raise _problem("RUN_NOT_FOUND", "Aero run was not found", status.HTTP_404_NOT_FOUND)
    return run


def _same(left: str | None, right: str | None) -> bool:
    return bool(left and right and hmac.compare_digest(left, right))


def _commit(db: Session) -> None:
    try:
        db.commit()
    except (StaleDataError, IntegrityError):
        db.rollback()
        raise _problem("RUN_RACE", "This run changed in another request; reload before continuing") from None


def _view(db: Session, run: AeroRun, key: bytes) -> dict:
    return protocol.run_view(db, run, key)


def _require_valid_journal(db: Session, run: AeroRun, key: bytes) -> None:
    journal = protocol.verify_event_chain(db, run, key)
    payloads = protocol.verify_run_payloads(run, key)
    if not journal["valid"] or not payloads["valid"]:
        raise _problem(
            "JOURNAL_INTEGRITY_FAILED" if not journal["valid"] else "RUN_PAYLOAD_INTEGRITY_FAILED",
            "The server-owned Aero journal failed verification" if not journal["valid"] else "Encrypted Aero run data failed verification",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


def _contract(run: AeroRun, key: bytes) -> dict:
    try:
        return protocol.decrypt_contract(run, key)
    except protocol.ProtocolError as error:
        raise _problem(error.code, error.message, status.HTTP_500_INTERNAL_SERVER_ERROR) from None


def _snapshot(value: dict) -> dict:
    try:
        return protocol.normalize_snapshot(value)
    except protocol.ProtocolError as error:
        raise _problem(error.code, error.message) from None


@router.post("", status_code=status.HTTP_201_CREATED)
def prepare_run(
    body: AeroRunPrepareIn,
    auth: tuple[User, AuthToken] = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    key = _key()
    user = auth[0]
    try:
        contract = protocol.normalize_contract(body)
    except protocol.ProtocolError as error:
        raise _problem(error.code, error.message) from None
    contract_digest = protocol.digest_value(contract)
    existing = db.scalar(
        select(AeroRun).where(AeroRun.user_id == user.id, AeroRun.request_id == body.request_id)
    )
    if existing is not None:
        if not _same(existing.contract_digest, contract_digest):
            raise _problem("IDEMPOTENCY_CONFLICT", "This request ID is already bound to another contract")
        result = _view(db, existing, key)
        result.update({"idempotent": True, "review": protocol.contract_review(contract)})
        return result

    run_id = uuid.uuid4().hex
    run = AeroRun(
        id=run_id,
        user_id=user.id,
        request_id=body.request_id,
        status="prepared",
        contract_digest=contract_digest,
        contract_ciphertext="",
        event_sequence=0,
        event_head_digest="",
        recovery_count=0,
        version=1,
    )
    run.contract_ciphertext = protocol.seal_json(key, contract, protocol.contract_aad(run))
    db.add(run)
    protocol.append_event(
        db,
        run,
        key,
        "run.prepared",
        {
            "contractDigest": contract_digest,
            "actionCount": len(contract["actions"]),
            "capabilities": contract["capabilities"],
            "route": contract["route"],
        },
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raced = db.scalar(
            select(AeroRun).where(AeroRun.user_id == user.id, AeroRun.request_id == body.request_id)
        )
        if raced is None or not _same(raced.contract_digest, contract_digest):
            raise _problem("IDEMPOTENCY_CONFLICT", "This request ID is already bound to another contract") from None
        run = raced
    result = _view(db, run, key)
    result.update({"idempotent": False, "review": protocol.contract_review(contract)})
    return result


@router.get("/{run_id}")
def get_run(
    run_id: str,
    auth: tuple[User, AuthToken] = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    key = _key()
    run = _owned_run(db, auth[0], run_id)
    result = _view(db, run, key)
    result["review"] = protocol.contract_review(_contract(run, key))
    return result


@router.post("/{run_id}/approve")
def approve_run(
    run_id: str,
    body: AeroApproveIn,
    auth: tuple[User, AuthToken] = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    key = _key()
    run = _owned_run(db, auth[0], run_id)
    _require_valid_journal(db, run, key)
    if run.status != "prepared":
        raise _problem("RUN_NOT_PREPARED", "Only a prepared run can receive approval")
    if not _same(run.contract_digest, body.contract_digest):
        raise _problem("CONTRACT_CHANGED", "Approval does not match the prepared contract")
    _contract(run, key)
    raw_token, token_hash = security.new_token()
    run.status = "approved"
    run.approval_token_hash = token_hash
    run.approval_expires_at = utcnow() + timedelta(seconds=config.AERO_APPROVAL_TTL_SECONDS)
    protocol.append_event(
        db,
        run,
        key,
        "approval.issued",
        {"contractDigest": run.contract_digest, "expiresAt": run.approval_expires_at.isoformat() + "Z"},
    )
    _commit(db)
    return {
        "id": run.id,
        "status": run.status,
        "contractDigest": run.contract_digest,
        "approvalToken": raw_token,
        "expiresAt": run.approval_expires_at,
    }


@router.post("/{run_id}/lease")
def lease_run(
    run_id: str,
    body: AeroLeaseIn,
    auth: tuple[User, AuthToken] = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    key = _key()
    run = _owned_run(db, auth[0], run_id)
    _require_valid_journal(db, run, key)
    if run.status != "approved":
        raise _problem("RUN_NOT_APPROVED", "This run has no unused approval")
    if not _same(run.contract_digest, body.contract_digest):
        raise _problem("CONTRACT_CHANGED", "Execution does not match the approved contract")
    if not _same(run.approval_token_hash, security.hash_token(body.approval_token)):
        raise _problem("APPROVAL_INVALID", "Approval token is invalid", status.HTTP_403_FORBIDDEN)
    if run.approval_expires_at is None or run.approval_expires_at < utcnow():
        run.status = "prepared"
        run.approval_token_hash = None
        protocol.append_event(db, run, key, "approval.expired", {"contractDigest": run.contract_digest})
        _commit(db)
        raise _problem("APPROVAL_EXPIRED", "Approval expired before execution")

    contract = _contract(run, key)
    before = _snapshot(body.before_snapshot.model_dump())
    before_digest = protocol.digest_value(before)
    try:
        target, patches = protocol.simulate_transition(before, contract, run.id)
    except protocol.ProtocolError as error:
        raise _problem(error.code, error.message) from None
    target_digest = protocol.digest_value(target)
    lease_token, lease_hash = security.new_token()
    now = utcnow()
    run.status = "leased"
    run.before_digest = before_digest
    run.before_ciphertext = protocol.seal_json(key, before, protocol.snapshot_aad(run, "before", before_digest))
    run.target_digest = target_digest
    run.target_ciphertext = protocol.seal_json(key, target, protocol.snapshot_aad(run, "target", target_digest))
    run.approval_consumed_at = now
    run.approval_token_hash = None
    run.lease_token_hash = lease_hash
    run.lease_expires_at = now + timedelta(seconds=config.AERO_LEASE_TTL_SECONDS)
    protocol.append_event(
        db,
        run,
        key,
        "execution.leased",
        {
            "contractDigest": run.contract_digest,
            "beforeDigest": before_digest,
            "targetDigest": target_digest,
            "patchCount": len(patches),
            "expiresAt": run.lease_expires_at.isoformat() + "Z",
        },
    )
    _commit(db)
    return {
        "id": run.id,
        "status": run.status,
        "contractDigest": run.contract_digest,
        "beforeDigest": before_digest,
        "targetDigest": target_digest,
        "leaseToken": lease_token,
        "expiresAt": run.lease_expires_at,
        "patches": patches,
    }


@router.post("/{run_id}/attest")
def attest_run(
    run_id: str,
    body: AeroAttestIn,
    auth: tuple[User, AuthToken] = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    key = _key()
    run = _owned_run(db, auth[0], run_id)
    _require_valid_journal(db, run, key)
    if run.status != "leased":
        raise _problem("RUN_NOT_LEASED", "This run is not awaiting execution evidence")
    if not _same(run.contract_digest, body.contract_digest):
        raise _problem("CONTRACT_CHANGED", "Evidence does not match the approved contract")
    if not _same(run.lease_token_hash, security.hash_token(body.lease_token)):
        raise _problem("LEASE_INVALID", "Execution lease is invalid", status.HTTP_403_FORBIDDEN)
    if run.lease_expires_at is None or run.lease_expires_at < utcnow():
        run.status = "recovery_required"
        protocol.append_event(db, run, key, "execution.expired", {"targetDigest": run.target_digest})
        _commit(db)
        raise _problem("LEASE_EXPIRED", "Execution lease expired; restore the server-owned before snapshot")

    after = _snapshot(body.after_snapshot.model_dump())
    observed_digest = protocol.digest_value(after)
    if not _same(run.target_digest, observed_digest):
        run.status = "recovery_required"
        protocol.append_event(
            db,
            run,
            key,
            "attestation.rejected",
            {"expectedDigest": run.target_digest, "observedDigest": observed_digest},
        )
        _commit(db)
        raise _problem("POSTCONDITION_MISMATCH", "Observed Lyfe state does not match the server-issued target")

    run.status = "completed"
    run.lease_token_hash = None
    protocol.append_event(
        db,
        run,
        key,
        "run.completed",
        {"contractDigest": run.contract_digest, "targetDigest": run.target_digest},
    )
    certificate = protocol.completion_certificate(run)
    run.certificate_digest = certificate["digest"]
    _commit(db)
    certificate["journal"] = protocol.verify_event_chain(db, run, key)
    return certificate


@router.post("/{run_id}/recover")
def recover_run(
    run_id: str,
    body: AeroRecoverIn,
    auth: tuple[User, AuthToken] = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    key = _key()
    run = _owned_run(db, auth[0], run_id)
    _require_valid_journal(db, run, key)
    if run.status not in {"leased", "recovery_required"}:
        raise _problem("RECOVERY_NOT_ALLOWED", "Only an incomplete leased run can be recovered")
    if not _same(run.contract_digest, body.contract_digest):
        raise _problem("CONTRACT_CHANGED", "Recovery does not match the approved contract")
    if not run.before_ciphertext or not run.before_digest:
        raise _problem("RECOVERY_SNAPSHOT_MISSING", "No durable before snapshot is available", 500)
    try:
        before = protocol.open_json(
            key, run.before_ciphertext, protocol.snapshot_aad(run, "before", run.before_digest)
        )
    except protocol.ProtocolError as error:
        raise _problem(error.code, error.message, status.HTTP_500_INTERNAL_SERVER_ERROR) from None
    if not _same(protocol.digest_value(before), run.before_digest):
        raise _problem("RECOVERY_SNAPSHOT_INVALID", "Durable before snapshot failed integrity verification", 500)
    recovery_token, recovery_hash = security.new_token()
    run.status = "recovering"
    run.recovery_token_hash = recovery_hash
    run.recovery_expires_at = utcnow() + timedelta(seconds=config.AERO_RECOVERY_TTL_SECONDS)
    run.recovery_count += 1
    protocol.append_event(
        db,
        run,
        key,
        "recovery.issued",
        {"beforeDigest": run.before_digest, "recoveryCount": run.recovery_count},
    )
    _commit(db)
    return {
        "id": run.id,
        "status": run.status,
        "contractDigest": run.contract_digest,
        "beforeDigest": run.before_digest,
        "beforeSnapshot": before,
        "recoveryToken": recovery_token,
        "expiresAt": run.recovery_expires_at,
    }


@router.post("/{run_id}/recover/confirm")
def confirm_recovery(
    run_id: str,
    body: AeroRecoverConfirmIn,
    auth: tuple[User, AuthToken] = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    key = _key()
    run = _owned_run(db, auth[0], run_id)
    _require_valid_journal(db, run, key)
    if run.status != "recovering":
        raise _problem("RUN_NOT_RECOVERING", "No recovery is awaiting confirmation")
    if not _same(run.contract_digest, body.contract_digest):
        raise _problem("CONTRACT_CHANGED", "Recovery confirmation does not match the run")
    if not _same(run.recovery_token_hash, security.hash_token(body.recovery_token)):
        raise _problem("RECOVERY_TOKEN_INVALID", "Recovery token is invalid", status.HTTP_403_FORBIDDEN)
    if run.recovery_expires_at is None or run.recovery_expires_at < utcnow():
        run.status = "recovery_required"
        run.recovery_token_hash = None
        protocol.append_event(
            db,
            run,
            key,
            "recovery.expired",
            {"beforeDigest": run.before_digest, "recoveryCount": run.recovery_count},
        )
        _commit(db)
        raise _problem("RECOVERY_EXPIRED", "Recovery confirmation expired")
    restored = _snapshot(body.restored_snapshot.model_dump())
    restored_digest = protocol.digest_value(restored)
    if not _same(run.before_digest, restored_digest):
        raise _problem("RECOVERY_MISMATCH", "Restored state does not match the durable before snapshot")
    run.status = "recovered"
    run.recovery_token_hash = None
    run.lease_token_hash = None
    protocol.append_event(
        db,
        run,
        key,
        "run.recovered",
        {"beforeDigest": run.before_digest, "recoveryCount": run.recovery_count},
    )
    certificate = protocol.completion_certificate(run)
    run.certificate_digest = certificate["digest"]
    _commit(db)
    certificate["journal"] = protocol.verify_event_chain(db, run, key)
    return certificate


@router.post("/{run_id}/forget", status_code=status.HTTP_204_NO_CONTENT)
def forget_run(
    run_id: str,
    body: AeroForgetRunIn,
    auth: tuple[User, AuthToken] = Depends(current_user),
    db: Session = Depends(get_db),
) -> None:
    run = _owned_run(db, auth[0], run_id)
    if not _same(run.contract_digest, body.contract_digest):
        raise _problem("CONTRACT_CHANGED", "Deletion does not match the selected run")
    db.execute(delete(AeroRunEvent).where(AeroRunEvent.run_id == run.id))
    db.delete(run)
    db.commit()
