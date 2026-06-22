"""API integration tests — full upload→scan→report flow via TestClient.

External enrichers are stubbed in conftest.py, so the pipeline runs the real
static analysis, scoring, clustering and report generation, fully offline.
TestClient executes FastAPI background tasks synchronously, so by the time
POST /upload returns, the scan job has already finished.
"""

import io
import os

import pytest

from app import main as app_main

# EICAR antivirus test string, assembled at runtime so this source file is not
# itself flagged by AV scanners. The string is harmless by design, but every
# AV product (correctly) detects it — set MALSCAN_NO_EICAR=1 to skip that test
# if your AV quarantines it mid-run.
EICAR = (b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$" + b"EICAR-STANDARD-ANTIVIRUS" + b"-TEST-FILE!$H+H*")


def _upload(client, content: bytes, filename: str):
    return client.post("/upload", files={"file": (filename, io.BytesIO(content), "application/octet-stream")})


# ── Upload flow ───────────────────────────────────────────────────────────────

def test_upload_and_complete_flow(client):
    res = _upload(client, b"hello, this file mentions http://some-site.example/thing and 9.9.9.9", "note.txt")
    assert res.status_code == 200
    job_id = res.json()["job_id"]

    status = client.get(f"/status/{job_id}").json()
    assert status["status"] == "Completed"
    results = status["results"]
    assert results["verdict"] in ("Clear", "Suspicious", "Malicious")
    assert "9.9.9.9" in results["indicators"]["ips"]
    assert isinstance(results["score"], int)


@pytest.mark.skipif(os.environ.get("MALSCAN_NO_EICAR") == "1", reason="AV interferes with EICAR on this machine")
def test_eicar_upload_is_malicious(client):
    res = _upload(client, EICAR, "eicar.com.txt")
    job_id = res.json()["job_id"]
    results = client.get(f"/status/{job_id}").json()["results"]
    assert results["score"] == 100
    assert results["verdict"] == "Malicious"
    assert results["family"] == "EICAR-Test-File"


def test_oversized_upload_rejected(client):
    big = b"0" * (app_main.MAX_UPLOAD_BYTES + 1)
    res = _upload(client, big, "big.bin")
    assert res.status_code == 413


def test_hostile_filename_is_handled(client):
    res = _upload(client, b"plain content", "../../evil<script>alert(1)</script>.txt")
    assert res.status_code == 200
    job_id = res.json()["job_id"]
    assert client.get(f"/status/{job_id}").json()["status"] == "Completed"


# ── URL submission ────────────────────────────────────────────────────────────

def test_submit_url_flow(client):
    res = client.post("/submit-url", json={"url": "http://test-target.example/update.exe"})
    assert res.status_code == 200
    job_id = res.json()["job_id"]
    results = client.get(f"/status/{job_id}").json()["results"]
    # plain HTTP (+20) and direct .exe download (+20) → at least Suspicious
    assert results["score"] >= 35
    assert results["verdict"] in ("Suspicious", "Malicious")


def test_submit_bare_domain_accepted(client):
    res = client.post("/submit-url", json={"url": "example.com"})
    assert res.status_code == 200


def test_submit_url_rejects_bad_schemes(client):
    for bad in ("javascript:alert(1)", "file:///etc/passwd", "not a url at all!", ""):
        res = client.post("/submit-url", json={"url": bad})
        assert res.status_code == 400, f"expected 400 for {bad!r}"


def test_submit_url_rejects_overlong(client):
    res = client.post("/submit-url", json={"url": "http://x.example/" + "a" * app_main.MAX_URL_LENGTH})
    assert res.status_code == 400


# ── Status & reports ──────────────────────────────────────────────────────────

def test_unknown_job_404(client):
    assert client.get("/status/no-such-job").status_code == 404
    assert client.get("/report/no-such-job").status_code == 404


def test_report_endpoints_and_csp(client):
    job_id = _upload(client, b"report me http://r.example/x", "r.txt").json()["job_id"]

    html_res = client.get(f"/report/{job_id}")
    assert html_res.status_code == 200
    assert "Content-Security-Policy" in html_res.headers
    assert html_res.headers["X-Content-Type-Options"] == "nosniff"
    assert "MalScan" in html_res.text

    json_res = client.get(f"/report/{job_id}/json")
    assert json_res.status_code == 200
    assert "score" in json_res.json()


# ── Rate limiting ─────────────────────────────────────────────────────────────

def test_rate_limit_triggers_429(client, monkeypatch):
    monkeypatch.setattr(app_main, "RATE_LIMIT_MAX", 3)
    for _ in range(3):
        assert client.post("/submit-url", json={"url": "http://rl.example/"}).status_code == 200
    res = client.post("/submit-url", json={"url": "http://rl.example/"})
    assert res.status_code == 429
