"use client"

import { useEffect, useState } from "react"
import { Capacitor } from "@capacitor/core"

/**
 * Raw listener for any ACTION_VIEW intent MalScan is opened with — either a
 * web link (Scenario 2: default-browser hijack) or a content:// URI (a file
 * opened via "Open with → MalScan", matched by the VIEW mimeType filter in
 * AndroidManifest.xml). The caller (components/NativeIntentBridge.tsx)
 * inspects the scheme to tell the two apart.
 *
 * @capacitor/app's 'appUrlOpen' event only fires via onNewIntent, which
 * Android calls for warm start (app already running) — never for the
 * cold-start launch itself. getLaunchUrl() is the only way to retrieve the
 * intent that *launched* the activity, so both must be checked.
 */
export function useLinkIntent(): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let handle: { remove: () => void } | undefined
    let cancelled = false

    import("@capacitor/app").then(({ App }) => {
      App.getLaunchUrl().then((result) => {
        if (!cancelled && result?.url) setUrl(result.url)
      })
      App.addListener("appUrlOpen", (data) => {
        if (data?.url) setUrl(data.url)
      }).then((h) => { handle = h })
    })

    return () => { cancelled = true; handle?.remove() }
  }, [])

  return url
}
