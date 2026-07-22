"""Password hashing and bearer-token helpers. Standard library only."""
import hashlib
import hmac
import secrets

from . import config

_SCHEME = "pbkdf2"
_HASH = "sha256"
_dummy_hash: str | None = None


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        _HASH, password.encode(), bytes.fromhex(salt), config.PBKDF2_ITERATIONS
    ).hex()
    return f"{_SCHEME}${_HASH}${config.PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, algo, iters, salt, digest = stored.split("$")
        if scheme != _SCHEME or algo != _HASH:
            return False
        candidate = hashlib.pbkdf2_hmac(
            algo, password.encode(), bytes.fromhex(salt), int(iters)
        ).hex()
        return hmac.compare_digest(candidate, digest)
    except (ValueError, TypeError):
        return False


def new_token() -> tuple[str, str]:
    """Returns (raw_token_for_client, sha256_hash_for_storage)."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def dummy_password_hash() -> str:
    """A valid hash used to equalize missing-user and wrong-password timing."""
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = hash_password("not-a-real-account-passphrase")
    return _dummy_hash
