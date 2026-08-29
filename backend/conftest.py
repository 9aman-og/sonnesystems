"""Test fixtures. Points the app at a throwaway SQLite file BEFORE app import."""
import os
import base64
import tempfile

os.environ["SONNE_DB_PATH"] = os.path.join(tempfile.mkdtemp(prefix="sonne-test-"), "test.db")
os.environ["SONNE_AERO_JOURNAL_KEY"] = base64.urlsafe_b64encode(b"aero-test-key-material-32-bytes!").decode().rstrip("=")

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c
