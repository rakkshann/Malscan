"""Unit tests for attribution_module/scoring.py — the verdict engine."""

from attribution_module.scoring import calculate_score

EICAR_SHA256 = "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f"


def test_benign_input_is_clear():
    result = calculate_score({})
    assert result["score"] == 0
    assert result["verdict"] == "Clear"
    assert result["reasons"] == []
    assert result["family"] == "Unknown"


def test_eicar_hash_is_malicious():
    result = calculate_score({"file_hash": EICAR_SHA256})
    assert result["score"] == 100
    assert result["verdict"] == "Malicious"
    assert result["family"] == "EICAR-Test-File"


def test_malwarebazaar_hit_is_malicious():
    result = calculate_score({
        "osint": {"malwarebazaar": {"found": True, "threat_name": "TestThreat", "first_seen": "2024"}},
    })
    assert result["score"] == 100
    assert result["verdict"] == "Malicious"
    assert any("MalwareBazaar" in r for r in result["reasons"])


def test_flagged_registrar_raises_score():
    result = calculate_score({
        "osint": {"whois": {"registrar": "NameCheap, Inc."}},
    })
    assert result["score"] >= 15
    assert any("Registrar" in r for r in result["reasons"])


def test_high_risk_country_and_asn():
    result = calculate_score({
        "osint": {"geoip": {"countryCode": "RU", "country": "Russia", "asn": "AS9009 M247 Ltd"}},
    })
    # +20 country, +20 suspicious ASN
    assert result["score"] >= 40
    assert result["verdict"] in ("Suspicious", "Malicious")


def test_url_flags_push_to_suspicious():
    result = calculate_score({
        "url": {"suspicious_flags": ["flag one", "flag two"]},
    })
    assert result["score"] >= 40
    assert result["verdict"] == "Suspicious"


def test_dangerous_apk_permissions_score():
    result = calculate_score({
        "apk": {
            "is_apk": True,
            "dangerous_permissions": [
                "android.permission.READ_SMS",
                "android.permission.SEND_SMS",
                "android.permission.READ_CONTACTS",
            ],
        },
    })
    # 3 dangerous perms (+20) and SMS read+send combo (+15)
    assert result["score"] >= 35
    assert any("SMS" in r for r in result["reasons"])


def test_ordinary_pdf_with_forms_is_clear():
    """Regression: a textbook/form PDF (JS + open-action, clean VT) must NOT be flagged.

    Real-world bug: scored 90/Malicious for an ordinary textbook PDF because
    /JavaScript (+40) and /OpenAction (+35) were treated as malware signals
    while a 62-engine clean VirusTotal result was ignored.
    """
    result = calculate_score({
        "document": {
            "doc_type": "pdf",
            "has_javascript": True,      # interactive form JS
            "has_auto_action": True,     # "open at page 1"
            "has_js_auto_combo": False,  # NOT wired together
        },
        "osint": {"virustotal": {"stats": {"malicious": 0, "suspicious": 0, "harmless": 0, "undetected": 62}}},
    })
    assert result["verdict"] == "Clear", f"benign PDF flagged: {result['score']} {result['reasons']}"


def test_driveby_pdf_combo_is_flagged():
    result = calculate_score({
        "document": {
            "doc_type": "pdf",
            "has_javascript": True,
            "has_auto_action": True,
            "has_js_auto_combo": True,   # JS bound directly to OpenAction
            "has_launch_action": True,
        },
    })
    assert result["score"] >= 70
    assert result["verdict"] == "Malicious"


def test_vt_clean_does_not_dampen_confirmed_intel():
    """A MalwareBazaar hash hit must stay Malicious even if VT engines miss it."""
    result = calculate_score({
        "osint": {
            "malwarebazaar": {"found": True, "threat_name": "FreshThreat", "first_seen": "2026"},
            "virustotal": {"stats": {"malicious": 0, "suspicious": 0, "harmless": 0, "undetected": 62}},
        },
    })
    assert result["score"] >= 70
    assert result["verdict"] == "Malicious"


def test_output_contract_keys():
    """Both frontends consume this exact shape — guard it."""
    result = calculate_score({"iocs": {"ips": ["1.2.3.4"], "domains": ["x.com"], "urls": []}})
    for key in ("score", "verdict", "family", "attribution", "reasons",
                "indicators", "osint_summary", "graph_nodes", "graph_edges"):
        assert key in result
    assert result["indicators"]["ips"] == ["1.2.3.4"]
