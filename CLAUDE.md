# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MALSCAN is a malware/threat-intelligence scanning platform with three parts in one repo:

- `backend/` — Python FastAPI backend, analysis modules, scoring modules, and offline tests
- `web/` — Next.js 16 web frontend (App Router, Tailwind 4, React 19)
- `mobile/` — Expo / React Native Android app (expo-router, RN 0.74)
- `Test files apk/`, `test_archive.zip`, `backend/test_files/` — sample artifacts for manual testing (`backend/generate_test_files.py` regenerates them)

The backend has an automated pytest suite (`malscan/backend/tests/`, fully offline — see below). The web and mobile frontends have no automated tests; verify those manually by running the backend + a client and submitting a file/URL.

## Commands

### Backend (FastAPI, must be started first)

```powershell
cd backend
pip install -r requirements.txt   # also installs/uses backend/analysis_engine modules
uvicorn app.main:app --reload                 # web-only dev (127.0.0.1:8000)
uvicorn app.main:app --host 0.0.0.0 --port 8000   # required for mobile device access
```

API keys live in `backend/.env` (`VT_API_KEY`, `URLSCAN_API_KEY`, `ABUSEIPDB_API_KEY`). All keys are optional — the pipeline skips enrichers whose keys are missing. abuse.ch feeds (MalwareBazaar, ThreatFox, URLhaus) need no key. `yara-python` is optional on Windows (needs VC++ build tools); YARA is skipped gracefully if absent.

**CORS** (`main.py`): allowed origins default to `http://localhost:3000` / `http://127.0.0.1:3000`. Set `MALSCAN_ALLOWED_ORIGINS` (comma-separated, or `*`) for other deployments — e.g. `MALSCAN_ALLOWED_ORIGINS=https://malscan.example`. This does not affect the web app (same-origin via the Next `/api` rewrite) or the mobile app (native client, no CORS).

**Security note — before any public deployment:** the API is currently unauthenticated. `GET /status/{job_id}` and `GET /report/{job_id}` are readable by anyone holding the `job_id` (unguessable `uuid4`, so not enumerable, but with no per-user ownership). Add authentication + an ownership filter on the `ScanJob` queries before exposing MALSCAN beyond a trusted LAN.

### Backend tests

```powershell
cd backend
pip install -r requirements-dev.txt   # pytest + httpx (TestClient), on top of requirements.txt
pytest                                 # all tests — run from backend/ so imports resolve
pytest tests/test_scoring.py           # one file
pytest tests/test_api.py::test_eicar_upload_is_malicious   # one test
```

The suite runs offline and deterministically: `conftest.py` stubs every network enricher and redirects the DB and vault to a temp dir via `MALSCAN_DB_URL` / `MALSCAN_VAULT_DIR` (both env vars are also honored in production — e.g. Postgres in the cloud). `test_api.py` exercises the real upload→scan→report pipeline through FastAPI's `TestClient`, which runs background tasks synchronously, so the scan has already finished by the time `POST /upload` returns. The API tests use the EICAR test string, which your AV may quarantine mid-run — set `MALSCAN_NO_EICAR=1` to skip that case.

### Web frontend

```powershell
cd web
npm run dev      # http://localhost:3000
npm run build
npm run lint     # eslint
```

The frontend never calls the backend directly — `web/next.config.ts` rewrites `/api/:path*` → `http://127.0.0.1:8000/:path*`. All client fetches use `/api/...` paths.

### Mobile app

```powershell
cd mobile
npm install                # postinstall runs patch-package (patches/expo-modules-core)
npx expo run:android       # dev build to connected device/emulator
cd android; .\gradlew assembleRelease   # standalone APK → android/app/build/outputs/apk/release/
```

The backend URL is hardcoded in `constants/config.ts` (`API_BASE_URL`, a LAN IP) and can be overridden at runtime in the app's Settings screen (persisted via `services/settings.ts`, applied in `app/_layout.tsx` through `updateApiBaseUrl`). Emulator uses `http://10.0.2.2:8000`; physical devices need the machine's LAN IP. See `DEPLOYMENT_PLAN.md` for the release/deployment stages.

## Architecture

### Scan pipeline (the core of the system)

Everything flows through `process_scan_job()` in `backend/app/main.py`, run as a FastAPI background task:

1. **Static analysis** — `backend/analysis_engine/static_analyzer.py` (IOC extraction, PE parsing/imphash/entropy, suspicious strings); ZIPs are extracted (zip-slip and zip-bomb guarded) and inner files analyzed recursively; APKs go through `apk_analyzer.py`; PDFs/Office docs through `document_analyzer.py`; YARA via `yara_scanner.py` (rules in `backend/analysis_engine/yara_rules/`)
2. **OSINT enrichment** — run concurrently on a `ThreadPoolExecutor`: whois/DNS/GeoIP (`osint_enricher.py`), VirusTotal (`vt_client.py`), URLScan (`urlscan_client.py`), MalwareBazaar/ThreatFox/URLhaus/AbuseIPDB clients. URLs matching `SAFE_DOMAIN_PATTERNS` in main.py are excluded from external scanning
3. **Scoring** — `backend/attribution_module/scoring.py` `calculate_score()` produces `{score 0-100, verdict Malicious|Suspicious|Clear, family, attribution, reasons, indicators, osint_summary, graph_nodes, graph_edges}`. It uses a known-hash blocklist, flagged registrars, and suspicious-ASN lists. The docstring at the top documents the exact input/output shapes
4. **Clustering** — `backend/attribution_module/clustering.py` compares the job against all previously completed jobs for shared IPs/domains/ASNs/registrars
5. **Reporting** — `backend/attribution_module/reporter.py` renders an HTML report to `backend/reports/report_{job_id}.html` (regenerated on demand if lost)

The final `score_data` dict is stored in the `ScanJob.results` JSON column — it is the single contract consumed by both the web report page and the mobile verdict screen (mirrored as the `ScanResults` type in `mobile/services/api.ts`). If you change scoring output shape, update both frontends.

**Import gotcha:** `analysis_engine/` and `attribution_module/` are subdirectories of `backend/`, imported via a `sys.path` insert in main.py. Uvicorn must be run from `backend/` for paths (`.env`, `app/vault`, relative DB) to resolve.

### API surface

- `POST /upload` (multipart, 50 MB cap) and `POST /submit-url` → `{job_id}`; artifact stored by SHA-256 in `backend/app/vault/`
- `GET /status/{job_id}` → status + results (clients poll this every ~2 s)
- `GET /report/{job_id}` (HTML) and `GET /report/{job_id}/json` (graph data)

Persistence is SQLite (`backend/malscan.db`) via SQLAlchemy; the only model is `ScanJob` in `app/models.py`.

### Frontends

- **Web** (`web/app/`): `page.tsx` (upload/URL submit) → `analysis/[id]` (polling progress) → `report/[id]` (full report, Leaflet GeoMap, html2pdf export)
- **Mobile** (`mobile/app/`): expo-router screens `index` → `scanning` → `verdict`, plus `history` and `settings`. Scan history is stored on-device (`services/history.ts`). The app registers Android intent filters so shared files open in MALSCAN ("airlock" flow); native config lives in `android/` (generated by `expo prebuild` but committed and hand-modified — don't regenerate it casually). Theming is dark/light via `contexts/ThemeContext.tsx`
