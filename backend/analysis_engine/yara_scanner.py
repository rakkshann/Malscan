"""
analysis_engine/yara_scanner.py

YARA scanning with graceful fallback when yara-python is not installed.
Loads all .yar files from the yara_rules/ directory.
"""

import os
import logging

logger = logging.getLogger(__name__)

RULES_DIR = os.path.join(os.path.dirname(__file__), "yara_rules")

_compiled_rules = None
_yara_available = None


def _load_rules():
    global _compiled_rules, _yara_available
    if _yara_available is not None:
        return _yara_available

    try:
        import yara

        rule_files = {}
        for fname in os.listdir(RULES_DIR):
            if fname.endswith(".yar") or fname.endswith(".yara"):
                path = os.path.join(RULES_DIR, fname)
                namespace = os.path.splitext(fname)[0]
                rule_files[namespace] = path

        if not rule_files:
            logger.warning("YARA: no rule files found in %s", RULES_DIR)
            _yara_available = False
            return False

        _compiled_rules = yara.compile(filepaths=rule_files)
        _yara_available = True
        logger.info("YARA: loaded %d rule file(s)", len(rule_files))
        return True

    except ImportError:
        logger.info("YARA: yara-python not installed — install with `pip install yara-python` to enable")
        _yara_available = False
        return False
    except Exception as e:
        logger.warning("YARA: failed to compile rules: %s", e)
        _yara_available = False
        return False


def scan_file(file_path: str) -> dict:
    """
    Scan a file with all loaded YARA rules.

    Returns:
        {
          "yara_available": bool,
          "yara_matches": [{"rule": str, "description": str, "severity": str}],
          "match_count": int,
        }
    """
    if not _load_rules() or _compiled_rules is None:
        return {"yara_available": False, "yara_matches": [], "match_count": 0}

    try:
        import yara
        matches = _compiled_rules.match(file_path, timeout=30)
        result_matches = []
        for m in matches:
            meta = m.meta or {}
            result_matches.append({
                "rule":        m.rule,
                "namespace":   m.namespace,
                "description": meta.get("description", m.rule),
                "severity":    meta.get("severity", "medium"),
            })

        return {
            "yara_available": True,
            "yara_matches":   result_matches,
            "match_count":    len(result_matches),
        }
    except Exception as e:
        logger.warning("YARA scan error for %s: %s", file_path, e)
        return {"yara_available": True, "yara_matches": [], "match_count": 0, "error": str(e)}
