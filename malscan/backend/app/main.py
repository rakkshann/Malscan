"""
backend/app/main.py
Team Member 2 — Backend & Integration Engineer (wiring updated by TM4)

Changes made by Team Member 4:
  - Pass iocs into analysis_data so scoring.py can use them
  - Call cluster_iocs() after scoring and merge result into score_data
  - Call generate_report() after job completes
  - Add GET /report/{job_id} endpoint to serve the HTML report
  - Add GET /report/{job_id}/json endpoint for frontend graph data
  - Remove hardcoded dummy fallback data
  - Store original_filename in job for the report
"""

import hashlib, os, uuid, sys, time, zipfile, tempfile, shutil
import asyncio
from concurrent.futures import ThreadPoolExecutor

# ── Safety limits ─────────────────────────────────────────────────────────────
MAX_UPLOAD_BYTES      = 50  * 1024 * 1024   # 50 MB hard cap
MAX_DECOMPRESSED_BYTES = 200 * 1024 * 1024  # 200 MB total decompressed
MAX_ZIP_FILE_COUNT    = 500                  # files inside a ZIP
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import HTMLResponse
from .database import SessionLocal, init_db
from .models import ScanJob

# Load .env from backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from analysis_engine.static_analyzer import extract_iocs, analyze_pe, analyze_suspicious_strings
    from analysis_engine.osint_enricher import get_whois, get_dns_records, get_geoip
    from analysis_engine.url_processor import analyze_url
    from analysis_engine.vt_client import get_url_report, get_file_report
    from analysis_engine.urlscan_client import scan_url as urlscan_scan
    from analysis_engine.apk_analyzer import analyze_apk
    from analysis_engine.document_analyzer import analyze_document
    from analysis_engine.yara_scanner import scan_file as yara_scan_file
    from analysis_engine.malwarebazaar_client import check_hash as mb_check_hash
    from analysis_engine.threatfox_client import check_iocs as tf_check_iocs
    from analysis_engine.urlhaus_client import check_urls as uh_check_urls
    from analysis_engine.abuseipdb_client import check_ips as ab_check_ips
    from attribution_module.scoring import calculate_score
    from attribution_module.clustering import cluster_iocs
    from attribution_module.reporter import generate_report, get_report_path
except ImportError as e:
    print(f"Warning: Module import failed: {e}")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

VAULT_DIR = "app/vault"
os.makedirs(VAULT_DIR, exist_ok=True)

# ── URL Allowlist — skip these safe domains for URLScan / analysis ────────────
SAFE_DOMAIN_PATTERNS = {
    "microsoft.com", "google.com", "googleapis.com", "gstatic.com",
    "w3.org", "xmlsoap.org", "openxmlformats.org", "xml.org",
    "apache.org", "java.sun.com", "sun.com", "oracle.com",
    "mozilla.org", "mozilla.com", "webkit.org",
    "github.com", "githubusercontent.com",
    "localhost", "127.0.0.1", "0.0.0.0", "::1",
    "schemas.microsoft.com", "purl.org", "dublincore.org",
    "apple.com", "adobe.com", "verisign.com",
}

def _is_safe_url(url: str) -> bool:
    """Returns True if the URL belongs to a known-safe domain."""
    try:
        from urllib.parse import urlparse
        host = urlparse(url).netloc.lower().split(":")[0]
        return any(host == s or host.endswith("." + s) for s in SAFE_DOMAIN_PATTERNS)
    except Exception:
        return False

def _pick_best_url(urls: list) -> str | None:
    """Returns the first URL that isn't from a known-safe domain, or None."""
    for url in (urls or []):
        if not _is_safe_url(url):
            return url
    return None

_osint_executor = ThreadPoolExecutor(max_workers=6, thread_name_prefix="osint")
init_db()


def process_scan_job(job_id: str, file_path: str, original_filename: str = "unknown", submitted_url: str = None):
    db = SessionLocal()
    job = db.query(ScanJob).filter(ScanJob.job_id == job_id).first()
    if not job:
        db.close()
        return

    try:
        job.status = "Processing"
        db.commit()

        # ── 1. Static Analysis ───────────────────────────────────────────────
        iocs    = extract_iocs(file_path)
        pe_info = analyze_pe(file_path)
        apk_info = {}
        archive_contents = []

        # ── 1b. ZIP Extraction (Zip-Slip safe) ────────────────────────────────
        is_zip = zipfile.is_zipfile(file_path)
        if is_zip and not original_filename.lower().endswith(".apk"):
            extract_dir = None
            try:
                extract_dir = tempfile.mkdtemp(prefix="malscan_zip_")
                with zipfile.ZipFile(file_path, "r") as zf:
                    members = zf.infolist()

                    # ── ZIP bomb: too many files ──────────────────────────────
                    if len(members) > MAX_ZIP_FILE_COUNT:
                        print(f"ZIP bomb blocked: {len(members)} files exceeds limit of {MAX_ZIP_FILE_COUNT}")
                        members = members[:MAX_ZIP_FILE_COUNT]

                    total_decompressed = 0
                    for member in members:
                        # ── ZIP bomb: decompressed size limit ─────────────────
                        total_decompressed += member.file_size
                        if total_decompressed > MAX_DECOMPRESSED_BYTES:
                            print(f"ZIP bomb blocked: decompressed size exceeds {MAX_DECOMPRESSED_BYTES // 1024 // 1024} MB")
                            break

                        # ── Zip Slip protection ───────────────────────────────
                        member_path = os.path.realpath(os.path.join(extract_dir, member.filename))
                        if not member_path.startswith(os.path.realpath(extract_dir)):
                            print(f"Zip Slip blocked: {member.filename}")
                            continue
                        if member.is_dir():
                            os.makedirs(member_path, exist_ok=True)
                            continue
                        os.makedirs(os.path.dirname(member_path), exist_ok=True)
                        with zf.open(member) as src, open(member_path, "wb") as dst:
                            dst.write(src.read())

                    for root, dirs, files in os.walk(extract_dir):
                        for fname in files:
                            inner_path = os.path.join(root, fname)
                            inner_iocs = extract_iocs(inner_path)
                            inner_pe   = analyze_pe(inner_path)
                            for k in ("ips", "domains", "urls"):
                                iocs[k] = list(set(iocs.get(k, []) + inner_iocs.get(k, [])))
                            pe_info["suspicious_sections"].extend(inner_pe.get("suspicious_sections", []))
                            if inner_pe.get("is_pe"):
                                pe_info["is_pe"] = True
                                pe_info["imphash"] = pe_info.get("imphash") or inner_pe.get("imphash")
                            archive_contents.append({
                                "name": fname,
                                "is_pe": inner_pe.get("is_pe", False),
                                "ioc_count": len(inner_iocs.get("urls", [])) + len(inner_iocs.get("ips", [])),
                            })
            except Exception as ze:
                print(f"ZIP extraction error: {ze}")
            finally:
                # Always clean up temp extraction directory
                if extract_dir and os.path.exists(extract_dir):
                    shutil.rmtree(extract_dir, ignore_errors=True)

        # ── 1c. APK Analysis ─────────────────────────────────────────────────
        if original_filename.lower().endswith(".apk"):
            apk_info = analyze_apk(file_path)
            for k in ("ips", "urls"):
                apk_key = f"dex_{k}"
                iocs[k] = list(set(iocs.get(k, []) + apk_info.get(apk_key, [])))

        # ── 1d. Document Analysis (PDF / Office / OLE) ───────────────────────
        doc_info = analyze_document(file_path, original_filename)

        # ── 1e. Suspicious string patterns ───────────────────────────────────
        string_info = analyze_suspicious_strings(file_path)
        pe_info["suspicious_strings"] = string_info.get("suspicious_strings", [])

        # ── 1f. YARA scan ────────────────────────────────────────────────────
        yara_result = yara_scan_file(file_path)

        # ── 2. OSINT Enrichment (concurrent) ──────────────────────────────────
        osint_data = {}
        loop = asyncio.new_event_loop()

        domains = iocs.get("domains", [])
        urls = iocs.get("urls", [])
        
        # Ensure submitted_url is processed if it's a direct domain or url submission
        if submitted_url:
            if submitted_url.startswith("http://") or submitted_url.startswith("https://"):
                if submitted_url not in urls:
                    urls.append(submitted_url)
            else:
                if submitted_url not in domains:
                    domains.append(submitted_url)
                    
        if not domains and urls:
            from urllib.parse import urlparse
            for u in urls:
                try:
                    host = urlparse(u).netloc.split(":")[0]
                    if host and host not in domains:
                        domains.append(host)
                except Exception:
                    pass
            iocs["domains"] = domains

        ips = iocs.get("ips", [])
        vt_key = os.environ.get("VT_API_KEY")
        us_key = os.environ.get("URLSCAN_API_KEY")

        # Pick the best (non-safe) URL for external scanning
        scan_target_url = submitted_url or _pick_best_url(iocs.get("urls", []))

        # Build a list of futures to run concurrently
        futures = {}
        if domains:
            futures["whois"] = loop.run_in_executor(_osint_executor, get_whois, domains[0])
            futures["dns"]   = loop.run_in_executor(_osint_executor, get_dns_records, domains[0])
        import ipaddress
        import socket
        public_ips = []
        for ip in ips:
            try:
                if not ipaddress.ip_address(ip).is_private:
                    public_ips.append(ip)
            except ValueError:
                pass

        if not public_ips and domains:
            try:
                resolved_ip = socket.gethostbyname(domains[0])
                if not ipaddress.ip_address(resolved_ip).is_private:
                    public_ips.append(resolved_ip)
                    iocs["ips"].append(resolved_ip)
            except Exception:
                pass

        if public_ips:
            futures["geoip"] = loop.run_in_executor(_osint_executor, get_geoip, public_ips[0])
        if scan_target_url and vt_key:
            futures["vt_url"] = loop.run_in_executor(_osint_executor, get_url_report, scan_target_url, vt_key)
        if scan_target_url and us_key:
            futures["urlscan"] = loop.run_in_executor(_osint_executor, urlscan_scan, scan_target_url, us_key)
        if not submitted_url and vt_key:
            futures["vt_file"] = loop.run_in_executor(
                _osint_executor, get_file_report, job.file_hash, vt_key, file_path
            )

        # ── New: abuse.ch threat intelligence (no key required) ──────────────
        futures["malwarebazaar"] = loop.run_in_executor(
            _osint_executor, mb_check_hash, job.file_hash
        )
        if iocs.get("urls"):
            futures["urlhaus"] = loop.run_in_executor(
                _osint_executor, uh_check_urls, iocs.get("urls", [])
            )
        futures["threatfox"] = loop.run_in_executor(
            _osint_executor, tf_check_iocs,
            iocs.get("ips", []), iocs.get("domains", []),
            iocs.get("urls", []), job.file_hash
        )
        ab_key = os.environ.get("ABUSEIPDB_API_KEY")
        if public_ips and ab_key:
            futures["abuseipdb"] = loop.run_in_executor(
                _osint_executor, ab_check_ips, public_ips, ab_key
            )

        # Await all concurrently
        async def _gather_osint():
            results = {}
            for key, fut in futures.items():
                try:
                    results[key] = await fut
                except Exception as e:
                    print(f"OSINT task '{key}' failed: {e}")
                    results[key] = {"error": str(e)}
            return results

        osint_results = loop.run_until_complete(_gather_osint())
        loop.close()

        # Merge results into osint_data
        if "whois" in osint_results:
            osint_data["whois"] = osint_results["whois"]
        if "dns" in osint_results:
            osint_data["dns"] = osint_results["dns"]
        if "geoip" in osint_results:
            osint_data["geoip"] = osint_results["geoip"]
        if "vt_url" in osint_results:
            vt_result = osint_results["vt_url"]
            if "error" not in vt_result:
                osint_data["virustotal"] = vt_result
        if "urlscan" in osint_results:
            osint_data["urlscan"] = osint_results["urlscan"]
        if "vt_file" in osint_results:
            vt_file_result = osint_results["vt_file"]
            if "error" not in vt_file_result and "status" not in vt_file_result:
                osint_data["virustotal"] = vt_file_result

        # New threat intel feeds
        for key in ("malwarebazaar", "threatfox", "urlhaus", "abuseipdb"):
            if key in osint_results and "error" not in (osint_results[key] or {}):
                osint_data[key] = osint_results[key]

        # ── 3. Build analysis_data for scoring ───────────────────────────────
        analysis_data = {
            "file_hash": job.file_hash,
            "static": {
                "suspicious_sections": pe_info.get("suspicious_sections", []),
                "is_pe":               pe_info.get("is_pe", False),
                "imphash":             pe_info.get("imphash"),
                "file_entropy":        pe_info.get("file_entropy", 0.0),
                "magic_type":          pe_info.get("magic_type", "Unknown"),
                "type_mismatch":       pe_info.get("type_mismatch", False),
                "suspicious_strings":  pe_info.get("suspicious_strings", []),
            },
            "osint":    {**osint_data, "yara": yara_result},
            "url":      analyze_url(_pick_best_url(iocs.get("urls", [])) or (iocs["urls"][0] if iocs.get("urls") else "")) if iocs.get("urls") else {},
            "iocs":     iocs,
            "apk":      apk_info,
            "document": doc_info,
        }

        # ── 4. Attribution Scoring ───────────────────────────────────────────
        score_data = calculate_score(analysis_data)

        # ── 5. Infrastructure Clustering (cross-job) ─────────────────────────
        all_completed_jobs = (
            db.query(ScanJob)
              .filter(ScanJob.status == "Completed")
              .all()
        )
        cluster_result = cluster_iocs(job_id, score_data, all_completed_jobs)
        score_data["clusters"] = cluster_result

        # ── 6. Report Generation ─────────────────────────────────────────────
        raw_meta = {
            "file_hash":         job.file_hash,
            "original_filename": original_filename,
            "is_pe":             pe_info.get("is_pe", False),
            "imphash":           pe_info.get("imphash"),
            "suspicious_sections": pe_info.get("suspicious_sections", []),
        }
        generate_report(job_id, score_data, raw_meta)

        # ── 7. Simulate processing delay for UI realism ──────────────────────
        time.sleep(3)

        # Merge file metadata into results so frontend can display them
        score_data["file_hash"] = job.file_hash
        score_data["imphash"]   = pe_info.get("imphash")
        if archive_contents:
            score_data["archive_contents"] = archive_contents
        if apk_info.get("is_apk"):
            score_data["apk_info"] = apk_info
        if doc_info and doc_info.get("doc_type") not in (None, "unknown"):
            score_data["document_info"] = doc_info
        if yara_result.get("yara_matches"):
            score_data["yara_matches"] = yara_result["yara_matches"]

        job.results = score_data
        job.status  = "Completed"
        db.commit()

    except Exception as e:
        print(f"Job {job_id} failed: {e}")
        job.status = "Failed"
        db.commit()
    finally:
        db.close()


# ── Upload ────────────────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds maximum allowed size of {MAX_UPLOAD_BYTES // 1024 // 1024} MB.")
    file_hash = hashlib.sha256(content).hexdigest()

    file_path = os.path.join(VAULT_DIR, file_hash)
    with open(file_path, "wb") as f:
        f.write(content)

    job_id = str(uuid.uuid4())
    db = SessionLocal()
    new_job = ScanJob(job_id=job_id, file_hash=file_hash, status="Submitted")
    db.add(new_job)
    db.commit()
    db.close()

    background_tasks.add_task(process_scan_job, job_id, file_path, file.filename or "unknown")

    return {"job_id": job_id, "status": "Submitted"}


# ── URL Submit ────────────────────────────────────────────────────────────────

class UrlSubmission(BaseModel):
    url: str

@app.post("/submit-url")
async def submit_url(background_tasks: BackgroundTasks, body: UrlSubmission):
    """Accepts a raw URL string, saves it as a vault artifact, and runs the full analysis pipeline."""
    url = body.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")

    content = url.encode("utf-8")
    file_hash = hashlib.sha256(content).hexdigest()

    file_path = os.path.join(VAULT_DIR, file_hash)
    with open(file_path, "wb") as f:
        f.write(content)

    job_id = str(uuid.uuid4())
    db = SessionLocal()
    new_job = ScanJob(job_id=job_id, file_hash=file_hash, status="Submitted")
    db.add(new_job)
    db.commit()
    db.close()

    background_tasks.add_task(process_scan_job, job_id, file_path, url, submitted_url=url)

    return {"job_id": job_id, "status": "Submitted"}


# ── Status ────────────────────────────────────────────────────────────────────

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    db = SessionLocal()
    try:
        job = db.query(ScanJob).filter(ScanJob.job_id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"job_id": job.job_id, "status": job.status, "results": job.results}
    finally:
        db.close()


# ── HTML Report ───────────────────────────────────────────────────────────────

@app.get("/report/{job_id}", response_class=HTMLResponse)
async def get_report_html(job_id: str):
    """Serves the full HTML forensic report for a completed job."""
    db = SessionLocal()
    try:
        job = db.query(ScanJob).filter(ScanJob.job_id == job_id).first()
    finally:
        db.close()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "Completed":
        raise HTTPException(status_code=202, detail=f"Job is not yet complete (status: {job.status})")

    report_path = get_report_path(job_id)
    if not os.path.exists(report_path):
        # Regenerate on-demand if the file was lost (e.g. container restart)
        raw_meta = {"file_hash": job.file_hash, "original_filename": "unknown"}
        generate_report(job_id, job.results, raw_meta)

    with open(report_path, "r", encoding="utf-8") as f:
        html = f.read()

    return HTMLResponse(content=html)


# ── JSON Report (for frontend graph) ─────────────────────────────────────────

@app.get("/report/{job_id}/json")
async def get_report_json(job_id: str):
    """
    Returns the full structured results JSON for a completed job.
    Includes graph_nodes, graph_edges, clusters — used by the frontend
    to render the live infrastructure graph widget.
    """
    db = SessionLocal()
    try:
        job = db.query(ScanJob).filter(ScanJob.job_id == job_id).first()
    finally:
        db.close()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "Completed":
        raise HTTPException(status_code=202, detail=f"Job not yet complete (status: {job.status})")

    return job.results
