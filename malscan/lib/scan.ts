import { apiUrl } from "./config"

export async function submitFileForScan(file: File | Blob, filename = "scan_target"): Promise<string> {
  const formData = new FormData()
  formData.append("file", file, filename)
  const res = await fetch(apiUrl("/api/upload"), { method: "POST", body: formData })
  if (!res.ok) throw new Error("Backend offline or error")
  const data = await res.json()
  return data.job_id
}

export async function submitUrlForScan(url: string): Promise<string> {
  const res = await fetch(apiUrl("/api/submit-url"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) throw new Error("Backend error")
  const data = await res.json()
  return data.job_id
}

export function looksLikeUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim())
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  apk: "application/vnd.android.package-archive",
  zip: "application/zip",
  exe: "application/x-msdownload",
  dll: "application/x-msdownload",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rtf: "application/rtf",
  rar: "application/x-rar-compressed",
  "7z": "application/x-7z-compressed",
  txt: "text/plain",
}

export function guessMimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  return MIME_BY_EXTENSION[ext] || "application/octet-stream"
}
