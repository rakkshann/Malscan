// Resolves where the FastAPI backend lives.
//
// Normal web deploy (npm run dev / next start): NEXT_PUBLIC_API_BASE_URL is
// unset, so apiUrl() returns paths unchanged and next.config.ts's rewrite
// proxies "/api/*" to the backend — exactly today's behaviour.
//
// Capacitor build (npm run build:capacitor): the app is static HTML/JS with
// no Next.js server, so there's no rewrite proxy. NEXT_PUBLIC_API_BASE_URL is
// baked in at build time as the default, and can be overridden at runtime
// (without rebuilding) via the in-app Settings page, stored in localStorage —
// mirroring malscan-mobile's constants/config.ts + Settings screen.
const BUILD_TIME_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ""

const STORAGE_KEY = "malscan_api_base_url"

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) return stored
  }
  return BUILD_TIME_API_BASE_URL
}

export function setApiBaseUrl(url: string): void {
  if (typeof window === "undefined") return
  if (url) window.localStorage.setItem(STORAGE_KEY, url)
  else window.localStorage.removeItem(STORAGE_KEY)
}

/**
 * path must start with "/api/..." (matches the existing call sites and the
 * next.config.ts rewrite). When a base URL is configured, the "/api" prefix
 * is stripped since the backend's own routes have no such prefix.
 */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl()
  if (!base) return path
  return base.replace(/\/$/, "") + path.replace(/^\/api/, "")
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl("/api/status/health-ping"), { cache: "no-store" })
    return res.ok || res.status === 404
  } catch {
    return false
  }
}
