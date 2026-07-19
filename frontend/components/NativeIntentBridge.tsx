"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useShareIntent } from "../hooks/useShareIntent"
import { useLinkIntent } from "../hooks/useLinkIntent"
import { submitFileForScan, submitUrlForScan, looksLikeUrl, guessMimeFromName } from "../lib/scan"
import { DefaultBrowserPrompt } from "./DefaultBrowserPrompt"

async function readSharedFileAsBlob(uri: string, mimeType: string): Promise<Blob> {
  const { Filesystem } = await import("@capacitor/filesystem")
  const { data } = await Filesystem.readFile({ path: uri })
  const base64 = typeof data === "string" ? data : await data.text()
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  return new Blob([bytes], { type: mimeType || "application/octet-stream" })
}

/**
 * Mounted once near the app root. Wires the two native interception
 * scenarios (Scenario 1: share sheet, Scenario 2: default-browser link taps)
 * to the existing scan pipeline and navigates straight to the scanning
 * screen — no manual confirmation step, matching the "instant handling"
 * requirement.
 */
export function NativeIntentBridge() {
  const router = useRouter()
  const { file, text } = useShareIntent()
  const linkUrl = useLinkIntent()

  // Scenario 1: file or text shared into MalScan from another app.
  useEffect(() => {
    if (!file) return
    let cancelled = false
    ;(async () => {
      try {
        const blob = await readSharedFileAsBlob(file.uri, file.mimeType)
        const jobId = await submitFileForScan(blob, file.name)
        if (!cancelled) {
          router.push(`/analysis?id=${jobId}&fileUri=${encodeURIComponent(file.uri)}&mimeType=${encodeURIComponent(file.mimeType)}`)
        }
      } catch (e) {
        console.error("[MalScan] Failed to scan shared file:", e)
      }
    })()
    return () => { cancelled = true }
  }, [file]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!text || !looksLikeUrl(text)) return
    let cancelled = false
    ;(async () => {
      try {
        const jobId = await submitUrlForScan(text.trim())
        if (!cancelled) router.push(`/analysis?id=${jobId}`)
      } catch (e) {
        console.error("[MalScan] Failed to scan shared link:", e)
      }
    })()
    return () => { cancelled = true }
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scenario 2 (link tapped while MalScan holds the browser role) AND the
  // "Open with → MalScan" file case both arrive through the same ACTION_VIEW
  // channel — only the URI scheme tells them apart. http/https is a real
  // link; content:// or file:// is a local file someone chose to open here.
  useEffect(() => {
    if (!linkUrl) return
    let cancelled = false
    ;(async () => {
      try {
        if (looksLikeUrl(linkUrl)) {
          const jobId = await submitUrlForScan(linkUrl)
          if (!cancelled) router.push(`/analysis?id=${jobId}&target=${encodeURIComponent(linkUrl)}`)
        } else {
          const name = decodeURIComponent(linkUrl.split("/").pop() || "scan_target")
          const mimeType = guessMimeFromName(name)
          const blob = await readSharedFileAsBlob(linkUrl, mimeType)
          const jobId = await submitFileForScan(blob, name)
          if (!cancelled) {
            router.push(`/analysis?id=${jobId}&fileUri=${encodeURIComponent(linkUrl)}&mimeType=${encodeURIComponent(mimeType)}`)
          }
        }
      } catch (e) {
        console.error("[MalScan] Failed to scan intercepted intent:", e)
      }
    })()
    return () => { cancelled = true }
  }, [linkUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  return <DefaultBrowserPrompt />
}
