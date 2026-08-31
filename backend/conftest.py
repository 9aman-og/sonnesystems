"""Test fixtures. Points the app at a throwaway SQLite file BEFORE app import."""
import os
import tempfile

os.environ["SONNE_DB_PATH"] = os.path.join(tempfile.mkdtemp(prefix="sonne-test-"), "test.db")

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c
