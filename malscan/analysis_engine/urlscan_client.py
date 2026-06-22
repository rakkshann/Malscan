"""
analysis_engine/urlscan_client.py
URLScan.io API client — sandbox analysis of URLs.

Fast path: their search API is checked first for a recent scan of the same
URL (by anyone) — instant result, no quota burned. Only genuinely unseen
URLs trigger a fresh scan + poll.
"""

import time
import logging
from datetime import datetime, timedelta, timezone

import requests

logger = logging.getLogger(__name__)

# A previous public scan of the same URL is trusted for this long.
RECENT_SCAN_MAX_AGE_DAYS = 7


def _parse_result(data: dict, scan_uuid: str) -> dict:
    page = data.get("page", {})
    verdicts = data.get("verdicts", {}).get("overall", {})
    lists = data.get("lists", {})
    return {
        "screenshot_url": f"https://urlscan.io/screenshots/{scan_uuid}.png",
        "page_url": data.get("task", {}).get("url"),
        "page_title": page.get("title", ""),
        "page_ip": page.get("ip", ""),
        "page_country": page.get("country", ""),
        "page_server": page.get("server", ""),
        "is_malicious": verdicts.get("malicious", False),
        "verdict_score": verdicts.get("score", 0),
        "outgoing_domains": (lists.get("domains") or [])[:10],
    }


def _find_recent_scan(url: str, headers: dict) -> dict | None:
    """Looks up an existing recent public scan of this exact URL — instant."""
    try:
        search = requests.get(
            "https://urlscan.io/api/v1/search/",
            params={"q": f'task.url:"{url}"', "size": 1},
            headers=headers,
            timeout=10,
        )
        if search.status_code != 200:
            return None
        hits = search.json().get("results") or []
        if not hits:
            return None

        hit = hits[0]
        scanned_at = datetime.fromisoformat(hit["task"]["time"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) - scanned_at > timedelta(days=RECENT_SCAN_MAX_AGE_DAYS):
            return None

        result_api = hit.get("result")
        scan_uuid = hit.get("_id", "")
        if not result_api:
            return None
        result = requests.get(result_api, headers=headers, timeout=15)
        if result.status_code != 200:
            return None
        logger.info(f"URLScan: reused existing scan {scan_uuid} from {scanned_at.date()}")
        return _parse_result(result.json(), scan_uuid)
    except Exception as e:
        logger.warning(f"URLScan search fast-path failed (falling back to fresh scan): {e}")
        return None


def scan_url(url: str, api_key: str) -> dict:
    """
    Returns sandbox data for a URL: screenshot URL, page metadata and the
    URLScan verdict. Reuses a recent existing scan when available; otherwise
    submits a fresh public scan and polls for completion.

    Returns dict with keys: screenshot_url, page_title, page_ip,
    page_country, is_malicious, verdict_score, outgoing_domains.
    Or 'error' / 'status: pending' on failure.
    """
    if not api_key:
        return {"error": "No URLScan API key provided"}

    headers = {"API-Key": api_key, "Content-Type": "application/json"}

    # 0. Fast path: a recent scan of this exact URL already exists
    existing = _find_recent_scan(url, headers)
    if existing is not None:
        return existing

    payload = {"url": url, "visibility": "public"}

    try:
        # 1. Submit the scan
        submit = requests.post(
            "https://urlscan.io/api/v1/scan/",
            headers=headers,
            json=payload,
            timeout=15,
        )

        if submit.status_code == 429:
            return {"error": "URLScan rate limit exceeded."}
        if submit.status_code not in (200, 201):
            error_detail = ""
            try:
                error_detail = submit.json().get("message", "")
            except Exception:
                pass

            # URLScan blocks scans of major/popular domains
            if "prevented" in error_detail.lower() or "blocked" in error_detail.lower():
                return {"error": "URLScan does not allow scanning this domain (major site blocked by policy)."}
            if error_detail:
                return {"error": f"URLScan error: {error_detail}"}
            return {"error": f"URLScan submit failed (HTTP {submit.status_code})"}

        result_url = submit.json().get("api")
        scan_uuid = submit.json().get("uuid")

        if not result_url:
            return {"error": "No result URL returned from URLScan."}

        # 2. Poll for completion. Typical scans finish in 15-35s; first check
        # after 6s (never ready sooner), then every 4s up to ~45s total so a
        # slow scan doesn't hold the whole pipeline hostage.
        time.sleep(6)
        for attempt in range(10):
            if attempt > 0:
                time.sleep(4)
            result = requests.get(result_url, headers=headers, timeout=15)
            if result.status_code == 200:
                return _parse_result(result.json(), scan_uuid)

        return {"status": "pending", "message": "URLScan analysis still running."}

    except requests.exceptions.Timeout:
        return {"error": "URLScan request timed out."}
    except Exception as e:
        logger.error(f"URLScan error: {e}")
        return {"error": str(e)}
