"""Environment-driven settings (12-factor style). No framework magic."""
import os
from pathlib import Path

PBKDF2_ITERATIONS = 600_000


def _bounded_int(name: str, default: int, minimum: int, maximum: int) -> int:
    """Read an integer setting without allowing unsafe operational extremes."""
    try:
        value = int(os.environ.get(name, default))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(value, maximum))


MAX_BODY_BYTES = _bounded_int("SONNE_MAX_BODY_BYTES", 65_536, 4_096, 1_048_576)
TOKEN_TTL_DAYS = _bounded_int("SONNE_TOKEN_TTL_DAYS", 7, 1, 30)


def db_path() -> str:
    """SQLite file location. Override with SONNE_DB_PATH (tests and deploys do)."""
    default = Path(__file__).resolve().parents[1] / "data" / "sonne.db"
    return os.environ.get("SONNE_DB_PATH", str(default))


def cors_origins() -> list[str]:
    """Comma-separated origins in SONNE_CORS_ORIGINS, with sane defaults."""
    default = "https://sonnesystems.com" if production() else (
        "https://sonnesystems.com,http://localhost:4180,http://127.0.0.1:4180"
    )
    raw = os.environ.get(
        "SONNE_CORS_ORIGINS",
        default,
    )
    return [o.strip() for o in raw.split(",") if o.strip()]


def trusted_hosts() -> list[str]:
    """Hosts accepted at the HTTP boundary; prevents forged Host headers."""
    default = "sonnesystems.com,api.sonnesystems.com" if production() else (
        "sonnesystems.com,api.sonnesystems.com,localhost,127.0.0.1,testserver"
    )
    raw = os.environ.get(
        "SONNE_TRUSTED_HOSTS",
        default,
    )
    return [host.strip() for host in raw.split(",") if host.strip()]


def production() -> bool:
    return os.environ.get("SONNE_ENV", "development").lower() == "production"
