"""Unit tests for analysis_engine/url_processor.py heuristics."""

from analysis_engine.url_processor import analyze_url


def test_clean_https_brand_has_no_flags():
    result = analyze_url("https://www.google.com")
    assert result["suspicious_flags"] == []


def test_raw_ip_url_flagged():
    result = analyze_url("http://1.2.3.4/payload")
    flags = " ".join(result["suspicious_flags"])
    assert "raw IP" in flags


def test_http_not_https_flagged():
    result = analyze_url("http://example.com")
    flags = " ".join(result["suspicious_flags"])
    assert "HTTPS" in flags


def test_url_shortener_flagged():
    result = analyze_url("https://bit.ly/3xYzAbC")
    flags = " ".join(result["suspicious_flags"])
    assert "shortener" in flags


def test_suspicious_tld_flagged():
    result = analyze_url("https://free-prizes.xyz")
    flags = " ".join(result["suspicious_flags"])
    assert ".xyz" in flags


def test_typosquatting_detected():
    result = analyze_url("https://paypa1.com/login")
    flags = " ".join(result["suspicious_flags"])
    assert "impersonate" in flags


def test_brand_in_longer_domain_detected():
    result = analyze_url("https://hdfcbank-secure-login.com")
    flags = " ".join(result["suspicious_flags"])
    assert "impersonate" in flags


def test_dangerous_file_extension_flagged():
    result = analyze_url("https://example.com/update.exe")
    flags = " ".join(result["suspicious_flags"])
    assert ".exe" in flags


def test_empty_url_returns_clean_structure():
    result = analyze_url("")
    assert result["suspicious_flags"] == []
    assert result["domain"] is None
