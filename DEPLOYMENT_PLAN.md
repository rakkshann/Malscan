# MalScan — Deployment & Release Plan

> Saved 2026-05-30. A staged plan to take MalScan from "dev build on my laptop"
> to "standalone product the police (and anyone) can install and use."

---

## Stage 1 — Standalone Release APK (no PC tether for the app)

**Goal:** An APK that runs without Metro / USB cable. JavaScript is bundled
inside the APK. The app becomes fully independent (still talks to the backend
for scanning, but needs no developer setup).

**Why we need it:** Debug builds load JS from the Metro dev server on the PC
over an `adb reverse` USB tunnel. Unplug the cable → "Cannot connect to Metro".
A release build has the JS baked in, so it runs anywhere.

**Command:**
```powershell
cd d:\MALSCAN\Malscan\malscan-mobile\android
.\gradlew assembleRelease
```

**Output:**
```
android\app\build\outputs\apk\release\app-release.apk
```

**Time:** ~5–15 min first build (release builds optimise + shrink, slower than
debug). Subsequent builds ~2–4 min via Gradle cache.

**Notes:**
- Currently signs with the **debug keystore** — fine for testing/demo and for
  sideloading onto any phone. NOT acceptable for Play Store (see Stage 3).
- APK size ~50–80 MB.
- Can be copied to any Android phone and installed directly (enable "Install
  from unknown sources").
- Phone does NOT need to be connected to build; only to install (or copy APK manually).

**Caveat for the demo:** the app still needs the backend reachable. With the
backend on the laptop, the demo phone must be on the same WiFi and pointed at
the laptop's LAN IP (Settings → backend URL). For a true "works anywhere" demo,
do Stage 2 first.

---

## Stage 2 — Cloud Backend (app works on mobile data, anywhere)

**Goal:** Host the FastAPI backend in the cloud so the app works on any network
(mobile data, different WiFi) with no PC involved.

**Recommended platform:** Railway (railway.app)
- Native Python/FastAPI support
- ~$5/month (free credit covers light use)
- Deploys directly from the GitHub repo (github.com/rakkshann/Malscan)
- Persistent volumes for the vault
- Easy environment variables for API keys

**Required code changes:**
1. **Swap SQLite → PostgreSQL** — SQLite doesn't persist reliably on cloud
   containers. Railway provides free PostgreSQL. Change is minimal: just the
   connection string in `backend/app/database.py` (read from `DATABASE_URL` env var).
2. **Vault storage** — either a Railway persistent volume mounted at the vault
   path, or move to S3-compatible object storage (e.g. Cloudflare R2, free tier).
3. **Environment variables to set on Railway:**
   - `VT_API_KEY` — VirusTotal
   - `URLSCAN_API_KEY` — URLScan.io
   - `ABUSEIPDB_API_KEY` — AbuseIPDB (optional)
   - `DATABASE_URL` — auto-provided by Railway Postgres add-on
4. **YARA** — `yara-python` must build in the Railway container; add to
   `requirements.txt` and confirm the build image has the toolchain (or use a
   Dockerfile with `apt-get install libyara-dev`).
5. **CORS / host** — already binds `0.0.0.0`; confirm Railway's `$PORT` env var
   is respected in the uvicorn start command.

**After deploy:** the app's default backend URL changes from the LAN IP to the
Railway URL (e.g. `https://malscan-production.up.railway.app`). Update
`malscan-mobile/constants/config.ts` default and/or set it in the app's Settings.

**Cost:** ~$5–10/month.

---

## Stage 3 — Play Store Release (public distribution)

**Goal:** Anyone can download MalScan from the Play Store.

**Required:**
1. **Release keystore** (NOT the debug one). Generate a proper signing key:
   ```powershell
   keytool -genkeypair -v -keystore malscan-release.keystore `
     -alias malscan -keyalg RSA -keysize 2048 -validity 10000
   ```
   Store this keystore + passwords SAFELY. If lost, you can never update the
   app on the Play Store again.
2. Configure `android/app/build.gradle` release signingConfig to use it.
3. Build an **AAB** (Android App Bundle, Play Store's preferred format):
   ```powershell
   .\gradlew bundleRelease
   ```
   Output: `android\app\build\outputs\bundle\release\app-release.aab`
4. **Google Play Developer account** — one-time **$25** fee.
5. Store listing: icon, screenshots, description, privacy policy (required —
   the app handles files, so a clear privacy policy is mandatory).
6. Data safety form — declare that files are uploaded to the backend for analysis.

**Cost:** $25 one-time.

---

## Stage 4 — Polish for production

- **App icon** — currently using a generic/placeholder. Design a proper icon via
  icon.kitchen or Figma using the palette (Carbon Fiber bg #1C201E, accent
  #6B8C7A). Generate all mipmap densities and replace in
  `android/app/src/main/res/mipmap-*/`.
- **Custom domain** — `api.malscan.app` instead of the Railway slug (~$10/year).
- **Push notifications** — notify when a background scan completes (Expo Push,
  free, but needs the cloud backend).
- **Splash screen** — branded splash with the logo.
- **Privacy policy page** — host a simple page (required for Play Store).

---

## Cost summary

| Item | Cost | When |
|------|------|------|
| Release APK (sideload) | Free | Stage 1 — anytime |
| Cloud backend (Railway) | ~$5–10/mo | Stage 2 — before untethered demo |
| Custom domain | ~$10/yr | Stage 4 — optional polish |
| Play Store account | $25 once | Stage 3 — public launch |

**Minimum for a credible "works anywhere" police demo:** Stage 1 + Stage 2
(~$5–10/month, no upfront).

**For public launch:** add Stage 3 ($25 one-time).

---

## Recommended order for the police demo

1. **Stage 2 first** (cloud backend) — so the app isn't tied to the laptop.
2. **Stage 1** (release APK) — pointed at the cloud backend.
3. Pre-load scan history with known malware samples (EICAR, a flagged PDF, a
   malicious APK) so there are impressive high-score verdicts ready to show.
4. Do a **live scan** of something suspicious during the demo.
5. Show the **Share Report** feature — looks like evidence they could file.

The forensic report + infrastructure clustering + attribution are the strongest
selling points for law enforcement.
