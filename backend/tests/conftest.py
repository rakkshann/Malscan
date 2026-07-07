"""
Shared test fixtures.

Environment overrides MUST happen before `app.main` is imported, because the
DB engine, vault dir and .env keys are all resolved at import time.
"""

import os
import sys
import socket
import tempfile

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MALSCAN_DIR = os.path.dirname(BACKEND_DIR)

_tmp = tempfile.mkdtemp(prefix="malscan_test_")
os.environ["MALSCAN_DB_URL"] = "sqlite:///" + os.path.join(_tmp, "test.db").replace("\\", "/")
os.environ["MALSCAN_VAULT_DIR"] = os.path.join(_tmp, "vault")
# Force external enrichers off even if backend/.env defines keys
# (load_dotenv does not override pre-set vars).
os.environ["VT_API_KEY"] = ""
os.environ["URLSCAN_API_KEY"] = ""
os.environ["ABUSEIPDB_API_KEY"] = ""

for p in (BACKEND_DIR, MALSCAN_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

from app import main as app_main  # noqa: E402
from attribution_module import reporter  # noqa: E402

# Keep generated reports out of the real reports/ folder
reporter.REPORTS_DIR = os.path.join(_tmp, "reports")


@pytest.fixture(autouse=True)
def offline_pipeline(monkeypatch):
    """Stub every network-touching enricher so tests are fast, deterministic and offline."""
    monkeypatch.setattr(app_main, "get_whois", lambda d: {})
    monkeypatch.setattr(app_main, "get_dns_records", lambda d: {"A": [], "MX": [], "TXT": []})
    monkeypatch.setattr(app_main, "get_geoip", lambda ip: {})
    monkeypatch.setattr(app_main, "mb_check_hash", lambda h: {"found": False})
    monkeypatch.setattr(app_main, "tf_check_iocs", lambda *a, **k: {"found": False})
    monkeypatch.setattr(app_main, "uh_check_urls", lambda u: {"found": False})
    monkeypatch.setattr(app_main, "ab_check_ips", lambda *a, **k: {"skipped": True})
    # main.py resolves domains via socket inside the job — keep that offline too
    monkeypatch.setattr(socket, "gethostbyname", lambda d: (_ for _ in ()).throw(OSError("offline test")))
    # skip the artificial 3 s "UI realism" delay
    monkeypatch.setattr(app_main.time, "sleep", lambda s: None)
    # isolate the rate limiter between tests
    app_main._submission_log.clear()
    yield


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    with TestClient(app_main.app) as c:
        yield c
