"""
attribution_module/clustering.py
Team Member 4 — Attribution & Security Engineer

Pure clustering algorithm. Given the current job's results and a lookup of which
PRIOR jobs already contain each of the current job's indicators (built from the
inverted index in backend/app/indicator_index.py), it identifies shared
infrastructure (same IP, domain, ASN, registrar).

cluster_iocs(current_job_id, current_results, prior_lookup) -> dict

Output is merged into ScanJob.results under the "clusters" key.
"""

import logging

logger = logging.getLogger(__name__)


# ── Risk signals ─────────────────────────────────────────────────────────────

RISK_SIGNALS = {
    "shared_ip":        "Multiple jobs resolve to the same IP — strong indicator of shared phishing infrastructure.",
    "shared_asn":       "Multiple artifacts hosted under the same ASN — possible bulk-registered campaign.",
    "shared_registrar": "Multiple domains share a registrar frequently abused for throwaway phishing domains.",
    "shared_domain":    "The same domain appears across multiple submitted artifacts.",
}


# ── Main clustering function ──────────────────────────────────────────────────

def cluster_iocs(current_job_id: str, current_results: dict, prior_lookup: dict) -> dict:
    """
    Called from main.py after calculate_score() completes.

    Args:
        current_job_id:  The job being processed right now.
        current_results: The dict returned by calculate_score() for this job.
        prior_lookup:    {kind: {value: [other_job_ids]}} from
                         indicator_index.lookup_prior_jobs() — the prior jobs that
                         already contain each of this job's indicators.

    Returns a dict (shape unchanged — consumed by the HTML report + mobile type):
    {
        "shared_ips":        { "1.2.3.4": ["job-abc", "job-cur"], ... },
        "shared_domains":    { "evil.com": ["job-abc", "job-cur"], ... },
        "shared_asns":       { "AS9009":   ["job-abc", "job-cur"], ... },
        "shared_registrars": { "Namecheap": ["job-abc", "job-cur"], ... },
        "risk_signals":      ["...human readable strings..."],
        "cluster_count":     int,
    }
    """
    indicators = current_results.get("indicators", {}) or {}
    osint      = current_results.get("osint_summary", {}) or {}
    risk_signals: list = []

    def _build(kind, values, signal_key, counted):
        shared = {}
        prior = prior_lookup.get(kind, {})
        for value in (values or []):
            others = prior.get(value)
            if not others:
                continue
            # de-dupe prior job ids, then append the current job
            job_ids = list(dict.fromkeys(others)) + [current_job_id]
            shared[value] = job_ids
            if counted:
                signal = f"{RISK_SIGNALS[signal_key]} Shared value: '{value}' seen in {len(job_ids)} job(s)."
            elif kind == "asn":
                signal = f"{RISK_SIGNALS[signal_key]} ASN: '{value}'."
            else:
                signal = f"{RISK_SIGNALS[signal_key]} Registrar: '{value}'."
            if signal not in risk_signals:
                risk_signals.append(signal)
        return shared

    asn = osint.get("asn")
    registrar = osint.get("registrar")

    shared_ips        = _build("ip",        indicators.get("ips"),             "shared_ip",        True)
    shared_domains    = _build("domain",    indicators.get("domains"),         "shared_domain",    True)
    shared_asns       = _build("asn",       [asn] if asn else [],              "shared_asn",       False)
    shared_registrars = _build("registrar", [registrar] if registrar else [],  "shared_registrar", False)

    cluster_count = len(shared_ips) + len(shared_domains) + len(shared_asns) + len(shared_registrars)

    logger.info(f"Job {current_job_id}: found {cluster_count} infrastructure cluster(s).")

    return {
        "shared_ips":        shared_ips,
        "shared_domains":    shared_domains,
        "shared_asns":       shared_asns,
        "shared_registrars": shared_registrars,
        "risk_signals":      risk_signals,
        "cluster_count":     cluster_count,
    }
