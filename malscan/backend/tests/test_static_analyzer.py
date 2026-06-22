"""Unit tests for analysis_engine/static_analyzer.py."""

import os
import tempfile

from analysis_engine.static_analyzer import extract_iocs, analyze_pe


def _write_temp(content: bytes) -> str:
    fd, path = tempfile.mkstemp(prefix="malscan_sa_")
    with os.fdopen(fd, "wb") as f:
        f.write(content)
    return path


def test_extract_iocs_finds_ips_and_urls():
    path = _write_temp(b"connect to http://bad-domain.example/payload.bin and ping 8.8.8.8 now")
    try:
        iocs = extract_iocs(path)
        assert "8.8.8.8" in iocs["ips"]
        assert any(u.startswith("http://bad-domain.example") for u in iocs["urls"])
    finally:
        os.unlink(path)


def test_extract_iocs_empty_file():
    path = _write_temp(b"")
    try:
        iocs = extract_iocs(path)
        assert iocs["ips"] == []
        assert iocs["urls"] == []
    finally:
        os.unlink(path)


def test_extract_iocs_missing_file():
    iocs = extract_iocs("definitely/not/a/real/file.bin")
    assert iocs == {"ips": [], "domains": [], "urls": []}


def test_analyze_pe_on_non_pe():
    path = _write_temp(b"just a text file, not an executable")
    try:
        info = analyze_pe(path)
        assert info.get("is_pe") is False
    finally:
        os.unlink(path)
