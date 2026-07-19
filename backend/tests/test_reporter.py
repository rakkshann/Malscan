"""XSS regression tests for attribution_module/reporter.py.

Strings rendered into the HTML report come straight out of hostile files
(filenames, embedded URLs, macro names...). The template MUST escape them.
"""

import os

from attribution_module import reporter

XSS = "<script>alert(1)</script>"


def _minimal_score_data(**overrides):
    data = {
        "score": 10,
        "verdict": "Clear",
        "reasons": [],
        "indicators": {"ips": [], "domains": [], "urls": []},
        "osint_summary": None,
        "clusters": None,
    }
    data.update(overrides)
    return data


def test_report_escapes_reasons_and_iocs(tmp_path):
    reporter.REPORTS_DIR = str(tmp_path)
    path = reporter.generate_report(
        "xss-test-job",
        _minimal_score_data(
            reasons=[f"Found bad thing {XSS}"],
            indicators={"ips": [], "domains": [], "urls": [f"http://evil.example/{XSS}"]},
        ),
        {"file_hash": "abc123", "original_filename": f"invoice{XSS}.pdf"},
    )
    html = open(path, encoding="utf-8").read()
    assert XSS not in html, "raw <script> tag leaked into the report — XSS!"
    assert "&lt;script&gt;" in html, "expected escaped form of the payload"


def test_report_file_written_to_reports_dir(tmp_path):
    reporter.REPORTS_DIR = str(tmp_path)
    path = reporter.generate_report("plain-job", _minimal_score_data(), {"file_hash": "h", "original_filename": "a.txt"})
    assert os.path.exists(path)
    assert path.endswith("report_plain-job.html")
