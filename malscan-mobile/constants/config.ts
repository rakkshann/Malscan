// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Set this to your machine's local IP address before running on
// a real Android device.
//
//   Windows → run `ipconfig` in PowerShell, look for "IPv4 Address"
//   Mac/Linux → run `ifconfig | grep inet`
//
// Android Emulator → use 'http://10.0.2.2:8000' (emulator loopback)
// Physical device → use 'http://192.168.x.x:8000' (your machine's LAN IP)
// ─────────────────────────────────────────────────────────────────────────────
export const API_BASE_URL = 'http://192.168.0.101:8000'

export const POLL_INTERVAL_MS = 2000
export const UPLOAD_TIMEOUT_MS = 60_000
