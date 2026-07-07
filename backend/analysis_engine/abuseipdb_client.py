"""
analysis_engine/abuseipdb_client.py

AbuseIPDB — IP reputation lookup.
Requires ABUSEIPDB_API_KEY env variable. Free tier: 1000 checks/day.
https://www.abuseipdb.com/api
"""

import os
import requests

_API = "https://api.abuseipdb.com/api/v2/check"
_TIMEOUT = 8


def check_ip(ip: str, api_key: str = None) -> dict:
    """
    Returns dict:
      abuse_confidence (0-100), total_reports, country, isp, is_whitelisted
    Returns {"skipped": True} if no API key or if IP is private.
    """
    key = api_key or os.environ.get("ABUSEIPDB_API_KEY")
    if not key or not ip:
        return {"skipped": True}

    try:
        resp = requests.get(
            _API,
            headers={"Key": key, "Accept": "application/json"},
            params={"ipAddress": ip, "maxAgeInDays": 90, "verbose": False},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        d = resp.json().get("data", {})
        return {
            "abuse_confidence": d.get("abuseConfidenceScore", 0),
            "total_reports":    d.get("totalReports", 0),
            "country":          d.get("countryCode"),
            "isp":              d.get("isp"),
            "is_whitelisted":   d.get("isWhitelisted", False),
        }
    except Exception as e:
        return {"error": str(e), "skipped": True}


def check_ips(ips: list, api_key: str = None) -> dict:
    """Check up to 3 IPs, return the highest confidence score result."""
    key = api_key or os.environ.get("ABUSEIPDB_API_KEY")
    if not key:
        return {"skipped": True}

    best = {"abuse_confidence": 0}
    for ip in (ips or [])[:3]:
        result = check_ip(ip, key)
        if result.get("abuse_confidence", 0) > best.get("abuse_confidence", 0):
            best = result
            best["checked_ip"] = ip
    return best
