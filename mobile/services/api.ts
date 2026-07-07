import axios from 'axios'
import * as FileSystem from 'expo-file-system'
import { API_BASE_URL, UPLOAD_TIMEOUT_MS } from '../constants/config'

export const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: UPLOAD_TIMEOUT_MS,
})

/** Called from _layout.tsx on startup after reading saved settings. */
export function updateApiBaseUrl(url: string): void {
  client.defaults.baseURL = url
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type JobStatus = 'Submitted' | 'Processing' | 'Completed' | 'Failed'

export interface StatusResponse {
  job_id: string
  status: JobStatus
  results: ScanResults | null
}

export interface ClusterResult {
  shared_ips: Record<string, string[]>
  shared_domains: Record<string, string[]>
  shared_asns: Record<string, string[]>
  shared_registrars: Record<string, string[]>
  risk_signals: string[]
  cluster_count: number
}

export interface UrlScanResult {
  is_malicious: boolean
  screenshot_url: string | null
  page_title: string | null
  page_ip: string | null
  page_country: string | null
  verdict_score: number
  error?: string
}

export interface ScanResults {
  score: number
  verdict: 'Malicious' | 'Suspicious' | 'Clear'
  family: string
  attribution: string
  reasons: string[]
  indicators: {
    ips: string[]
    domains: string[]
    urls: string[]
  }
  osint_summary: {
    registrar: string | null
    domain_age_days: number | null
    asn: string | null
    country: string | null
    country_code: string | null
    hosting: string | null
    lat: number | null
    lon: number | null
    city: string | null
    region: string | null
    dns_a_records: string[] | null
    virustotal: {
      malicious: number
      suspicious: number
      harmless: number
      undetected: number
    } | null
    urlscan: UrlScanResult | null
  }
  graph_nodes: Array<{ id: string; label: string; type: string; risk: string }>
  graph_edges: Array<{ source: string; target: string; relationship: string }>
  file_hash: string
  imphash: string | null
  apk_info?: {
    is_apk: boolean
    package: string
    app_label: string
    dangerous_permissions: string[]
    permissions: string[]
  }
  archive_contents?: Array<{ name: string; is_pe: boolean; ioc_count: number }>
  clusters?: ClusterResult
}

// ── Health check ──────────────────────────────────────────────────────────────

/**
 * Returns true if the backend is reachable.
 * Accepts ANY HTTP response (even 404) — only network errors return false.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    await axios.get(`${client.defaults.baseURL}/status/health-ping`, {
      timeout: 5000,
      validateStatus: () => true,
    })
    return true
  } catch {
    return false
  }
}

// ── Error helpers ─────────────────────────────────────────────────────────────

/** Matches MAX_UPLOAD_BYTES in backend/app/main.py */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export class FileTooLargeError extends Error {
  constructor() {
    super('This file is larger than the 50 MB scan limit.')
    this.name = 'FileTooLargeError'
  }
}

/** Turns any upload/poll failure into a message a non-technical user can act on. */
export function describeApiError(e: any): string {
  if (e instanceof FileTooLargeError) return e.message
  const detail = e?.response?.data?.detail
  if (detail) return String(detail)
  if (e?.response) return `The scan engine returned an error (HTTP ${e.response.status}). Please try again.`
  if (e?.code === 'ECONNABORTED') return 'The connection timed out. The file may be too large for your network, or the engine is overloaded.'
  if (e?.request) return 'Could not reach the scan engine. Make sure the backend is running and the URL in Settings is correct.'
  return e?.message || 'Something went wrong. Please try again.'
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function uploadFile(
  contentUri: string,
  filename = 'scan_target',
): Promise<string> {
  const ext = filename.split('.').pop() || 'bin'
  const localUri = `${FileSystem.cacheDirectory}malscan_upload.${ext}`

  await FileSystem.copyAsync({ from: contentUri, to: localUri })

  try {
    // Reject oversized files before burning a slow mobile upload —
    // the backend hard-caps at 50 MB anyway.
    const info = await FileSystem.getInfoAsync(localUri, { size: true })
    if (info.exists && (info.size ?? 0) > MAX_UPLOAD_BYTES) {
      throw new FileTooLargeError()
    }

    const formData = new FormData()
    formData.append('file', {
      uri: localUri,
      name: filename,
      type: 'application/octet-stream',
    } as any)

    const res = await client.post<{ job_id: string }>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    return res.data.job_id
  } finally {
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {})
  }
}

export async function submitUrl(url: string): Promise<string> {
  const res = await client.post<{ job_id: string }>('/submit-url', { url })
  return res.data.job_id
}

export async function getStatus(jobId: string): Promise<StatusResponse> {
  const res = await client.get<StatusResponse>(`/status/${jobId}`)
  return res.data
}

export async function openFileNatively(
  contentUri: string,
  mimeType?: string,
): Promise<void> {
  const { startActivityAsync } = await import('expo-intent-launcher')

  // Prefer the caller-supplied MIME type; fall back to extension guess.
  // Never pass 'application/octet-stream' — Android has no generic handler
  // for it and the chooser fails. Omitting the type lets Android detect it
  // from the content provider, which works for all common file types.
  const guessed = guessMime(contentUri)
  const resolved =
    mimeType && mimeType !== 'application/octet-stream' ? mimeType
    : guessed !== 'application/octet-stream' ? guessed
    : undefined

  await startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    ...(resolved ? { type: resolved } : {}),
  })
}

function guessMime(uri: string): string {
  const lower = uri.toLowerCase()
  if (lower.endsWith('.pdf'))  return 'application/pdf'
  if (lower.endsWith('.apk'))  return 'application/vnd.android.package-archive'
  if (lower.endsWith('.zip'))  return 'application/zip'
  if (lower.endsWith('.exe') || lower.endsWith('.dll')) return 'application/x-msdownload'
  if (lower.endsWith('.doc'))  return 'application/msword'
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.xls'))  return 'application/vnd.ms-excel'
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (lower.endsWith('.ppt'))  return 'application/vnd.ms-powerpoint'
  if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (lower.endsWith('.rtf'))  return 'application/rtf'
  if (lower.endsWith('.txt'))  return 'text/plain'
  if (lower.endsWith('.rar'))  return 'application/x-rar-compressed'
  if (lower.endsWith('.7z'))   return 'application/x-7z-compressed'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png'))  return 'image/png'
  if (lower.endsWith('.mp4'))  return 'video/mp4'
  return 'application/octet-stream'
}
