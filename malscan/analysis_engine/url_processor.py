"""
analysis_engine/url_processor.py

URL and domain analysis — heuristic scoring for suspicious links.
No external dependencies.
"""

import re
from urllib.parse import urlparse, unquote

# ── Keyword lists ─────────────────────────────────────────────────────────────

MALWARE_KEYWORDS = {
    "malware", "exploit", "payload", "backdoor", "dropper", "ransomware",
    "trojan", "keylogger", "botnet", "rootkit", "spyware", "adware",
    "virus", "worm", "stager", "shellcode", "c2", "cnc", "command-and-control",
    "phish", "phishing", "credential", "login-steal", "harvest",
    "inject", "overflow", "rop-chain", "heap-spray",
    "download", "downloader", "loader",
    "obfuscate", "encode", "base64", "powershell",
}

# ── Suspicious TLDs (commonly abused for malware, phishing, spam) ─────────────

SUSPICIOUS_TLDS = {
    # Free/abused ccTLDs
    ".tk", ".ml", ".ga", ".cf", ".gq",
    # Common in malware campaigns
    ".xyz", ".top", ".club", ".work", ".click", ".link", ".online",
    ".site", ".space", ".tech", ".shop", ".store", ".icu", ".live",
    # Test/reserved
    ".test", ".local", ".invalid", ".example", ".onion",
    # Others frequently seen in phishing
    ".pw", ".cc", ".su", ".to", ".ws", ".biz",
}

# ── URL shorteners (need expanding before analysis) ───────────────────────────

URL_SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "buff.ly",
    "adf.ly", "tiny.cc", "is.gd", "v.gd", "cutt.ly", "rb.gy",
    "shorturl.at", "tr.im", "snip.ly", "t.me", "wa.me",
    "youtu.be",   # YouTube short URLs are fine but flag for awareness
}

# ── Top brand domains for typosquatting detection ─────────────────────────────

BRAND_DOMAINS = {
    # Global
    "google.com", "youtube.com", "facebook.com", "instagram.com",
    "twitter.com", "x.com", "linkedin.com", "amazon.com", "microsoft.com",
    "apple.com", "netflix.com", "paypal.com", "ebay.com", "dropbox.com",
    "whatsapp.com", "telegram.org", "signal.org",
    # Indian banks
    "sbi.co.in", "hdfcbank.com", "icicibank.com", "axisbank.com",
    "bankofbaroda.in", "pnbindia.in", "canarabank.com",
    # Indian fintech / UPI
    "paytm.com", "phonepe.com", "razorpay.com", "gpay.app",
    # Indian government
    "incometax.gov.in", "mca.gov.in", "uidai.gov.in", "npci.org.in",
    "india.gov.in", "irctc.co.in", "epfindia.gov.in",
    # Indian e-commerce
    "flipkart.com", "myntra.com", "snapdeal.com", "meesho.com",
}


def _levenshtein(a: str, b: str) -> int:
    """O(m*n) edit distance — fast enough for short domain names."""
    m, n = len(a), len(b)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, n + 1):
            temp = dp[j]
            dp[j] = prev if a[i - 1] == b[j - 1] else 1 + min(prev, dp[j], dp[j - 1])
            prev = temp
    return dp[n]


def _check_typosquatting(domain: str) -> str | None:
    """
    Returns the brand being impersonated if this domain looks like a typosquat,
    or None if it's clean.
    """
    # Strip www. prefix
    d = domain.lower().removeprefix("www.")

    # Exact match — it IS the brand
    if d in BRAND_DOMAINS:
        return None

    for brand in BRAND_DOMAINS:
        brand_host = brand.split(".")[0]  # e.g. "hdfcbank" from "hdfcbank.com"
        d_host     = d.split(".")[0]

        # Skip if brand is very short (too many false positives)
        if len(brand_host) < 5:
            continue

        # Levenshtein distance ≤ 2 on the hostname part
        if len(d_host) > 3 and _levenshtein(d_host, brand_host) <= 2:
            return brand

        # Brand name appears inside a longer domain (e.g. hdfcbank-secure.com)
        if brand_host in d and d != brand:
            return brand

    return None


def analyze_url(url: str) -> dict:
    """
    Heuristic analysis of a URL.
    Returns dict with 'suspicious_flags' list.
    """
    result = {
        "scheme": None, "domain": None, "path": None, "query": None,
        "suspicious_flags": [],
    }

    if not url:
        return result

    try:
        parsed = urlparse(unquote(url))
        result["scheme"] = parsed.scheme
        result["domain"] = parsed.netloc
        result["path"]   = parsed.path
        result["query"]  = parsed.query

        flags = result["suspicious_flags"]

        # ── Scheme ────────────────────────────────────────────────────────────
        if parsed.scheme and parsed.scheme.lower() not in ("https",):
            flags.append("Not using HTTPS — connection is unencrypted.")

        if parsed.netloc:
            domain_lower = parsed.netloc.lower().split(":")[0]  # strip port

            # ── Raw IP as host ─────────────────────────────────────────────────
            if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", domain_lower):
                flags.append(
                    "URL uses a raw IP address instead of a domain — common in C2 and phishing."
                )

            # ── Suspicious TLD ─────────────────────────────────────────────────
            for tld in SUSPICIOUS_TLDS:
                if domain_lower.endswith(tld):
                    flags.append(f"Suspicious domain extension '{tld}' — heavily abused in malware campaigns.")
                    break

            # ── URL shortener ──────────────────────────────────────────────────
            bare = domain_lower.removeprefix("www.")
            if bare in URL_SHORTENERS:
                flags.append(
                    f"URL shortener detected ({bare}) — hides the real destination, common in phishing."
                )

            # ── Typosquatting ──────────────────────────────────────────────────
            impersonated = _check_typosquatting(domain_lower)
            if impersonated:
                flags.append(
                    f"Domain appears to impersonate '{impersonated}' — possible phishing site."
                )

            # ── Excessive subdomains ───────────────────────────────────────────
            parts = domain_lower.split(".")
            if len(parts) > 5:
                flags.append("Unusually deep subdomain structure — common evasion technique.")

            # ── Very long domain ───────────────────────────────────────────────
            if len(domain_lower) > 60:
                flags.append("Excessively long domain name — may be generated or obfuscated.")

            # ── Malware keywords in domain ─────────────────────────────────────
            for kw in MALWARE_KEYWORDS:
                if kw in domain_lower:
                    flags.append(f"Threat-related keyword '{kw}' in domain name.")
                    break

            # ── Homoglyph substitution heuristic ──────────────────────────────
            homoglyphs = {"0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "rn": "m"}
            normalised = domain_lower
            for fake, real in homoglyphs.items():
                normalised = normalised.replace(fake, real)
            if normalised != domain_lower:
                imp2 = _check_typosquatting(normalised)
                if imp2:
                    flags.append(
                        f"Domain uses look-alike characters to impersonate '{imp2}' (e.g. 0→o, 1→l)."
                    )

        # ── Path + query analysis ──────────────────────────────────────────────
        path_query = ((parsed.path or "") + "?" + (parsed.query or "")).lower()
        matched = [kw for kw in MALWARE_KEYWORDS if kw in path_query]
        if matched:
            flags.append(f"Threat-related keyword(s) in URL path: {', '.join(matched[:3])}")

        # ── Suspicious file extension in URL ───────────────────────────────────
        dangerous_exts = (".exe", ".dll", ".bat", ".ps1", ".vbs", ".js", ".scr", ".hta", ".msi")
        path_lower = parsed.path.lower()
        for ext in dangerous_exts:
            if path_lower.endswith(ext):
                flags.append(f"URL points directly to a potentially dangerous file type ({ext}).")
                break

        # ── Encoded characters hiding content ──────────────────────────────────
        if url.count("%") > 10:
            flags.append("High number of URL-encoded characters — may be hiding malicious content.")

    except Exception as e:
        result["error"] = f"Failed to parse URL: {e}"

    return result
