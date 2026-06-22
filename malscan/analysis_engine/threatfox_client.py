"""
analysis_engine/threatfox_client.py

ThreatFox (abuse.ch) — IOC lookup for URLs, domains, IPs, and hashes.
Uses the free abuse.ch Auth-Key (ABUSECH_AUTH_KEY in backend/.env) when set.
https://threatfox.abuse.ch/api/
"""

import os
import requests

_API = "https://threatfox-api.abuse.ch/api/v1/"
_TIMEOUT = 10


def _auth_headers() -> dict:
    key = os.environ.get("ABUSECH_AUTH_KEY", "").strip()
    return {"Auth-Key": key} if key else {}


def _search(ioc: str) -> dict:
    try:
        resp = requests.post(
            _API,
            json={"query": "search_ioc", "search_term": ioc},
            headers=_auth_headers(),
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("query_status") != "ok":
            return {"found": False}

        results = data.get("data") or []
        if not results:
            return {"found": False}

        r = results[0]
        return {
            "found":      True,
            "malware":    r.get("malware"),
            "malware_printable": r.get("malware_printable"),
            "confidence": r.get("confidence_level"),
            "threat_type": r.get("threat_type"),
            "first_seen": r.get("first_seen"),
            "tags":       r.get("tags") or [],
        }
    except Exception as e:
        return {"error": str(e), "found": False}


def check_iocs(ips: list, domains: list, urls: list, file_hash: str = None) -> dict:
    """
    Checks all extracted IOCs against ThreatFox.
    Returns the first match found, or {"found": False}.
    """
    candidates = []
    if file_hash:
        candidates.append(file_hash)
    for ioc in (urls or [])[:5]:
        candidates.append(ioc)
    for ioc in (domains or [])[:5]:
        candidates.append(ioc)
    for ioc in (ips or [])[:5]:
        candidates.append(ioc)

    for candidate in candidates:
        result = _search(candidate)
        if result.get("found"):
            result["matched_ioc"] = candidate
            return result

    return {"found": False}
