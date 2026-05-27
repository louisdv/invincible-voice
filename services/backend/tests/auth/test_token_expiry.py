"""Verify JWT access tokens carry a 1-year expiry."""
import os
from datetime import datetime, timezone, timedelta

import jwt
import pytest


@pytest.fixture(autouse=True)
def _jwt_env(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret")


def test_access_token_expires_in_one_year():
    import importlib
    from backend import security
    importlib.reload(security)

    token = security.create_access_token({"sub": "arnaud@example.com"})
    decoded = jwt.decode(token, "test-secret", algorithms=["HS256"])
    exp = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
    now = datetime.now(timezone.utc)
    # 365 days ± 1 minute to absorb test runtime
    assert timedelta(days=365) - timedelta(minutes=1) < exp - now <= timedelta(days=365)
