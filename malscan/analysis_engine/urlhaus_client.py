"""
analysis_engine/urlhaus_client.py

URLhaus (abuse.ch) — malicious URL lookup.
No API key required. Free, public.
Specialises in malware distribution URLs.
https://urlhaus.abuse.ch/api/
"""

import requests

_API = "https://urlhaus-api.abuse.ch/v1/"
_TIMEOUT = 10


def check_url(url: str) -> dict:
    """
    Returns dict:
      found (bool), threat, tags, url_status, date_added
    """
    if not url:
        return {"found": False}
    try:
        resp = requests.post(
            _API + "url/",
            data={"url": url},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("query_status") == "no_results":
            return {"found": False}

        return {
            "found":      True,
            "threat":     data.get("threat"),
            "tags":       data.get("tags") or [],
            "url_status": data.get("url_status"),
            "date_added": data.get("date_added"),
        }
    except Exception as e:
        return {"error": str(e), "found": False}


def check_urls(urls: list) -> dict:
    """Check up to 5 URLs, return first match or {"found": False}."""
    for url in (urls or [])[:5]:
        result = check_url(url)
        if result.get("found"):
            result["matched_url"] = url
            return result
    return {"found": False}
