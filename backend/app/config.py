"""Environment-driven settings (12-factor style). No framework magic."""
import os
from pathlib import Path

TOKEN_TTL_DAYS = 30
PBKDF2_ITERATIONS = 310_000


def db_path() -> str:
    """SQLite file location. Override with SONNE_DB_PATH (tests and deploys do)."""
    default = Path(__file__).resolve().parents[1] / "data" / "sonne.db"
    return os.environ.get("SONNE_DB_PATH", str(default))


def cors_origins() -> list[str]:
    """Comma-separated origins in SONNE_CORS_ORIGINS, with sane defaults."""
    raw = os.environ.get(
        "SONNE_CORS_ORIGINS",
        "https://sonnesystems.com,http://localhost:4180,http://127.0.0.1:4180",
    )
    return [o.strip() for o in raw.split(",") if o.strip()]
