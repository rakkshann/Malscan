# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MALSCAN is a malware/threat-intelligence scanning platform, split into two top-level folders:

- `backend/` — Python FastAPI service: the API (`app/`), the analysis engine (`analysis_engine/`), and the attribution/scoring engine (`attribution_module/`). Has an offline pytest suite in `backend/tests/`.
- `frontend/` — Next.js 16 web app (App Router, Tailwind 4, React 19), which is also packaged as a native Android APK via Capacitor (`frontend/android/`).

`Test files apk/`, `test_archive.zip` are sample artifacts for manual testing (`backend/generate_test_files.py` regenerates them). The frontend has no automated tests; verify it manually by running the backend + the web app and submitting a file/URL.

> A React Native app (`malscan-mobile/`) was retired in favor of the Capacitor-wrapped web app and moved out of the repo (archived alongside it). Ignore references to it in older docs/commits.

## Commands

### Backend (FastAPI, must be started first)

```powershell
cd backend
pip install -r requirements.txt   # also: analysis_engine/requirements.txt + attribution_module/requirements.txt
playwright install chromium       # REQUIRED after pip install — downloads headless browser for PDF export
uvicorn app.main:app --reload --port 8001            # web-only dev (127.0.0.1:8001)
uvicorn app.main:app --host 0.0.0.0 --port 8001      # required for on-device (APK) access
```

Port 8001 (not 8000) matches the frontend's `/api` proxy in `next.config.ts` — port 8000 is taken by Splunk on the dev machine.

API keys live in `backend/.env` (`VT_API_KEY`, `URLSCAN_API_KEY`, `ABUSEIPDB_API_KEY`, `ABUSECH_AUTH_KEY`). All keys are optional — the pipeline skips enrichers whose keys are missing. `yara-python` is optional on Windows (needs VC++ build tools); YARA is skipped gracefully if absent.

**CORS** (`main.py`): allowed origins default to `http://localhost:3000` / `http://127.0.0.1:3000`. Set `MALSCAN_ALLOWED_ORIGINS` (comma-separated, or `*`) for other deployments. The web app reaches the API same-origin via the Next `/api` rewrite, so CORS does not apply there. The **Capacitor APK is different**: it runs from the `https://localhost` WebView origin and uses `fetch()`, so it **is** subject to CORS — the backend must allow that origin (`MALSCAN_ALLOWED_ORIGINS` including `https://localhost`, or `*`), or use the CapacitorHttp plugin to bypass CORS.

**Security note — before any public deployment (incl. a Cloudflare tunnel):** the API is currently unauthenticated. `GET /status/{job_id}` and `GET /report/{job_id}` are readable by anyone holding the `job_id` (unguessable `uuid4`, so not enumerable, but with no per-user ownership). Add authentication + an ownership filter on the `ScanJob` queries before exposing MALSCAN beyond a trusted LAN.

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
cd frontend
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint     # eslint
```

**API calls:** always use `apiUrl(path)` from `lib/config.ts` — never raw `/api/...` fetch. In web dev, `apiUrl` returns the path as-is and Next.js rewrites `/api/*` → `http://127.0.0.1:8001/*`. In the Capacitor APK build it prepends the configured backend URL and strips the `/api` prefix.

### Capacitor Android build (web app as native APK)

The `frontend/` web app is packaged as a native Android APK via Capacitor (`frontend/android/`).

```powershell
cd frontend
# Set backend URL at build time (baked into the APK), plus BUILD_TARGET=capacitor
# for the static export — both live in frontend/.env.capacitor (git-ignored;
# see .env.capacitor.example if present):
npm run build:capacitor   # dotenv -e .env.capacitor -- next build  → out/
npx cap sync android      # copies web assets into android/
# Then open frontend/android/ in Android Studio and build/run from there
```

Runtime override: the in-app Settings page (`app/settings/page.tsx`) lets users change the backend URL without rebuilding — stored in `localStorage`, read by `lib/config.ts:getApiBaseUrl()`. This is how the app points at a Cloudflare-tunnel URL for the laptop backend.

## Architecture

### Scan pipeline (the core of the system)

Everything flows through `process_scan_job()` in `backend/app/main.py`, run as a FastAPI background task:

1. **Static analysis** — `analysis_engine/static_analyzer.py` (IOC extraction, PE parsing/imphash/entropy, suspicious strings); ZIPs are extracted (zip-slip and zip-bomb guarded) and inner files analyzed recursively; APKs go through `apk_analyzer.py`; PDFs/Office docs through `document_analyzer.py`; YARA via `yara_scanner.py` (rules in `analysis_engine/yara_rules/`)
2. **OSINT enrichment** — run concurrently on a `ThreadPoolExecutor`: whois/DNS/GeoIP (`osint_enricher.py`), VirusTotal (`vt_client.py`), URLScan (`urlscan_client.py`), MalwareBazaar/ThreatFox/URLhaus/AbuseIPDB clients. URLs matching `SAFE_DOMAIN_PATTERNS` in main.py are excluded from external scanning
3. **Scoring** — `attribution_module/scoring.py` `calculate_score()` produces `{score 0-100, verdict Malicious|Suspicious|Clear, family, attribution, reasons, indicators, osint_summary, graph_nodes, graph_edges}`. It uses a known-hash blocklist, flagged registrars, and suspicious-ASN lists. The docstring at the top documents the exact input/output shapes
4. **Clustering** — `attribution_module/clustering.py` compares the job against prior jobs (via the inverted index in `app/indicator_index.py`) for shared IPs/domains/ASNs/registrars
5. **Reporting** — `attribution_module/reporter.py` renders an HTML report to `backend/reports/report_{job_id}.html` (regenerated on demand if lost)

The final `score_data` dict is stored in the `ScanJob.results` JSON column — it is the contract consumed by the web report page (`frontend/app/report/`). If you change scoring output shape, update the frontend.

**Import structure:** `analysis_engine/` and `attribution_module/` sit inside `backend/`, as siblings of the `app/` package, and are imported via a `sys.path` insert in `main.py` (which adds `backend/` to the path). Uvicorn must be run from `backend/` for the relative paths (`.env`, `app/vault`, the SQLite DB) to resolve.

### API surface

- `POST /upload` (multipart, 50 MB cap) and `POST /submit-url` → `{job_id}`; artifact stored by SHA-256 in `backend/app/vault/`
- `GET /status/{job_id}` → status + results (clients poll this every ~2 s)
- `GET /report/{job_id}` (HTML) and `GET /report/{job_id}/json` (graph data)
- `GET /report/{job_id}/pdf` — server-rendered PDF via headless Chromium (Playwright); requires `playwright install chromium`
- `GET /proxy/image?url=...` — proxies URLScan sandbox screenshots to avoid cross-origin canvas restrictions in the Capacitor WebView

Persistence is SQLite (`backend/malscan.db`) via SQLAlchemy; models are `ScanJob` and `IndicatorIndex` in `app/models.py`.

### Frontend

**Web** (`frontend/app/`): `page.tsx` (upload/URL submit) → `analysis/` (polling progress, job_id via query param/state) → `report/` (full report, Leaflet GeoMap, server-rendered PDF export). Routes are flat (no `[id]` segment) — job_id is passed via navigation state or query string. The same code, wrapped by Capacitor, is the Android APK; native intent filters in `frontend/android/` register the share-sheet / default-browser "airlock" flow (`hooks/useShareIntent.ts`, `hooks/useLinkIntent.ts`).
