"""
attribution_module/reporter.py
Team Member 4 — Attribution & Security Engineer

generate_report(job_id, score_data, raw_data) is called by main.py
once a job reaches "Completed" status.

Also exposes get_report_path(job_id) so the /report/{job_id} API
endpoint can serve the saved HTML file.
"""

import os
import json
from jinja2 import Template
import logging

logger = logging.getLogger(__name__)

REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "reports")

# ── HTML template ─────────────────────────────────────────────────────────────
# Styled to match the frontend's dark/orange MalScan Pro aesthetic.

REPORT_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>MalScan Pro — Report {{ job_id }}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:      #0A0A0A;
    --surface: #121212;
    --border:  #222;
    --accent:  #FF3B00;
    --text:    #F0F0F0;
    --muted:   #666;
    --green:   #22C55E;
    --amber:   #F59E0B;
    --red:     #EF4444;
    --mono:    'Courier New', monospace;
  }
  body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', sans-serif;
         font-size: 14px; line-height: 1.6; padding: 2rem; }
  header { display: flex; justify-content: space-between; align-items: center;
           border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; margin-bottom: 2rem; }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-dot { width: 12px; height: 12px; background: var(--accent); }
  .logo-text { font-size: 13px; font-family: var(--mono); font-weight: bold;
               letter-spacing: 0.2em; text-transform: uppercase; }
  .job-meta { font-family: var(--mono); font-size: 11px; color: var(--muted); text-align: right; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
  .card { background: var(--surface); border: 1px solid var(--border);
          border-radius: 4px; padding: 1.5rem; }
  .card-title { font-size: 10px; font-family: var(--mono); letter-spacing: 0.25em;
                text-transform: uppercase; color: var(--muted); margin-bottom: 1rem;
                padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
  .verdict-badge { display: inline-block; padding: 6px 18px; border-radius: 2px;
                   font-family: var(--mono); font-size: 13px; font-weight: bold;
                   letter-spacing: 0.15em; text-transform: uppercase; }
  .badge-Malicious  { background: rgba(239,68,68,0.15);  color: var(--red);   border: 1px solid var(--red); }
  .badge-Suspicious { background: rgba(245,158,11,0.15); color: var(--amber); border: 1px solid var(--amber); }
  .badge-Clear      { background: rgba(34,197,94,0.15);  color: var(--green); border: 1px solid var(--green); }
  .score-bar-wrap { margin: 1rem 0; }
  .score-bar-track { background: #222; height: 6px; border-radius: 3px; overflow: hidden; }
  .score-bar-fill  { height: 100%; border-radius: 3px;
                     background: {% if score_data.score >= 70 %}var(--red){% elif score_data.score >= 35 %}var(--amber){% else %}var(--green){% endif %}; 
                     width: {{ score_data.score }}%; }
  .score-label { display: flex; justify-content: space-between; font-family: var(--mono);
                 font-size: 11px; color: var(--muted); margin-bottom: 4px; }
  .reasons-list { list-style: none; }
  .reasons-list li { font-size: 12px; color: #ccc; padding: 6px 0;
                     border-bottom: 1px solid var(--border); display: flex; gap: 10px; }
  .reasons-list li:last-child { border-bottom: none; }
  .bullet { color: var(--accent); flex-shrink: 0; }
  .kv-table { width: 100%; border-collapse: collapse; }
  .kv-table td { padding: 6px 4px; font-size: 12px; vertical-align: top; }
  .kv-table td:first-child { color: var(--muted); font-family: var(--mono); font-size: 11px;
                              white-space: nowrap; padding-right: 16px; width: 130px; }
  .kv-table td:last-child  { color: var(--text); word-break: break-all; }
  .kv-table tr { border-bottom: 1px solid var(--border); }
  .kv-table tr:last-child { border-bottom: none; }
  .ioc-list { list-style: none; max-height: 220px; overflow-y: auto; }
  .ioc-list li { display: flex; justify-content: space-between; align-items: center;
                 padding: 5px 0; border-bottom: 1px solid var(--border); font-family: var(--mono); font-size: 11px; }
  .ioc-list li:last-child { border-bottom: none; }
  .ioc-type { color: var(--accent); width: 60px; flex-shrink: 0; letter-spacing: 0.1em; }
  .ioc-val  { color: #ccc; flex: 1; word-break: break-all; }
  .cluster-item { background: rgba(255,59,0,0.05); border: 1px solid rgba(255,59,0,0.2);
                  border-radius: 3px; padding: 10px 14px; margin-bottom: 8px; font-size: 12px; }
  .cluster-item p { color: #aaa; margin-top: 4px; font-size: 11px; }
  .full-width { grid-column: 1 / -1; }
  .no-data { color: var(--muted); font-size: 12px; font-style: italic; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border);
           font-family: var(--mono); font-size: 10px; color: var(--muted);
           display: flex; justify-content: space-between; }
</style>
</head>
<body>

<header>
  <div class="logo">
    <div class="logo-dot"></div>
    <span class="logo-text">MalScan Pro // Forensic Report</span>
  </div>
  <div class="job-meta">
    <div>JOB ID: {{ job_id }}</div>
    <div>GENERATED: {{ generated_at }}</div>
  </div>
</header>

<div class="grid">

  <!-- VERDICT CARD -->
  <div class="card">
    <div class="card-title">Analysis Verdict</div>
    <span class="verdict-badge badge-{{ score_data.verdict }}">{{ score_data.verdict }}</span>
    <div class="score-bar-wrap" style="margin-top:1.25rem;">
      <div class="score-label"><span>Threat Score</span><span>{{ score_data.score }} / 100</span></div>
      <div class="score-bar-track"><div class="score-bar-fill"></div></div>
    </div>
    <ul class="reasons-list" style="margin-top:1rem;">
      {% for reason in score_data.reasons %}
      <li><span class="bullet">&rsaquo;</span> {{ reason }}</li>
      {% else %}
      <li><span class="bullet">&rsaquo;</span> No suspicious indicators found.</li>
      {% endfor %}
    </ul>
  </div>

  <!-- OSINT SUMMARY CARD -->
  <div class="card">
    <div class="card-title">OSINT Attribution Summary</div>
    {% set osint = score_data.osint_summary %}
    {% if osint %}
    <table class="kv-table">
      <tr><td>Registrar</td><td>{{ osint.registrar or "N/A" }}</td></tr>
      <tr><td>Domain Age</td><td>{% if osint.domain_age_days is not none %}{{ osint.domain_age_days }} days{% else %}Unknown{% endif %}</td></tr>
      <tr><td>ASN</td><td>{{ osint.asn or "N/A" }}</td></tr>
      <tr><td>Hosting</td><td>{{ osint.hosting or "N/A" }}</td></tr>
      <tr><td>Country</td><td>{{ osint.country or "N/A" }} {% if osint.country_code %}({{ osint.country_code }}){% endif %}</td></tr>
      <tr><td>DNS A Records</td><td>{{ (osint.dns_a_records or []) | join(", ") or "None resolved" }}</td></tr>
    </table>
    {% else %}
    <p class="no-data">No OSINT data available for this job.</p>
    {% endif %}
  </div>

  <!-- IOC TABLE -->
  <div class="card">
    <div class="card-title">Extracted Indicators (IoCs)</div>
    {% set indicators = score_data.indicators %}
    {% if indicators %}
    <ul class="ioc-list">
      {% for ip in (indicators.ips or []) %}
      <li><span class="ioc-type">IPv4</span><span class="ioc-val">{{ ip }}</span></li>
      {% endfor %}
      {% for domain in (indicators.domains or []) %}
      <li><span class="ioc-type">DOMAIN</span><span class="ioc-val">{{ domain }}</span></li>
      {% endfor %}
      {% for url in (indicators.urls or []) %}
      <li><span class="ioc-type">URL</span><span class="ioc-val">{{ url }}</span></li>
      {% endfor %}
      {% if not indicators.ips and not indicators.domains and not indicators.urls %}
      <li><span class="ioc-val no-data">No IoCs extracted.</span></li>
      {% endif %}
    </ul>
    {% else %}
    <p class="no-data">No indicators data.</p>
    {% endif %}
  </div>

  <!-- ARTIFACT METADATA -->
  <div class="card">
    <div class="card-title">Artifact Metadata</div>
    <table class="kv-table">
      <tr><td>SHA-256</td><td style="font-size:10px;">{{ raw_data.file_hash or "N/A" }}</td></tr>
      <tr><td>Filename</td><td>{{ raw_data.original_filename or "N/A" }}</td></tr>
      <tr><td>Is PE</td><td>{{ raw_data.get("is_pe", "Unknown") }}</td></tr>
      <tr><td>Imphash</td><td style="font-size:10px;">{{ raw_data.get("imphash") or "N/A" }}</td></tr>
      {% if raw_data.get("suspicious_sections") %}
      <tr><td>PE Sections</td><td>
        {% for s in raw_data.suspicious_sections %}
          <div>{{ s.name }}: {{ s.reason }}</div>
        {% endfor %}
      </td></tr>
      {% endif %}
    </table>
  </div>

  <!-- INFRASTRUCTURE CLUSTERS -->
  <div class="card full-width">
    <div class="card-title">Infrastructure Clusters</div>
    {% set clusters = score_data.clusters %}
    {% if clusters and clusters.cluster_count %}
      {% for signal in clusters.risk_signals %}
      <div class="cluster-item">
        <strong>&rsaquo; Infrastructure Link Detected</strong>
        <p>{{ signal }}</p>
      </div>
      {% endfor %}
      {% for ip, jobs in (clusters.shared_ips or {}).items() %}
      <div class="cluster-item">
        <strong>Shared IP: {{ ip }}</strong>
        <p>Seen in jobs: {{ jobs | join(", ") }}</p>
      </div>
      {% endfor %}
      {% for asn, jobs in (clusters.shared_asns or {}).items() %}
      <div class="cluster-item">
        <strong>Shared ASN: {{ asn }}</strong>
        <p>Seen in jobs: {{ jobs | join(", ") }}</p>
      </div>
      {% endfor %}
    {% else %}
      <p class="no-data">No cross-job infrastructure clusters detected for this submission.</p>
    {% endif %}
  </div>

</div>

<footer>
  <span>MalScan Pro — Forensic Attribution Engine v1.0</span>
  <span>This report is for investigative purposes only. Not a substitute for professional threat analysis.</span>
</footer>

</body>
</html>"""


# ── Public API ────────────────────────────────────────────────────────────────

def get_report_path(job_id: str) -> str:
    """Returns the expected filesystem path for a job's HTML report."""
    return os.path.join(REPORTS_DIR, f"report_{job_id}.html")


def generate_report(job_id: str, score_data: dict, raw_data: dict) -> str:
    """
    Renders and saves an HTML forensic report for the given job.
    Called by backend/app/main.py when a job completes.

    Args:
        job_id:     The unique job identifier.
        score_data: The full dict returned by calculate_score().
        raw_data:   Any extra artifact metadata (file_hash, original_filename, etc.)

    Returns:
        The absolute path to the saved HTML report file.
    """
    from datetime import datetime

    os.makedirs(REPORTS_DIR, exist_ok=True)

    template = Template(REPORT_TEMPLATE)
    html = template.render(
        job_id=job_id,
        score_data=score_data,
        raw_data=raw_data,
        generated_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
    )

    report_path = get_report_path(job_id)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(html)

    logger.info(f"Report saved: {report_path}")
    return report_path
