"use client"

import { useEffect, useState } from "react"
import { Capacitor } from "@capacitor/core"

export interface SharedFile {
  uri: string
  name: string
  mimeType: string
}

export interface ShareIntent {
  file: SharedFile | null
  text: string | null
}

/**
 * Raw listener for content shared into MalScan via the Android share sheet
 * (Scenario 1 — WhatsApp etc). Returns the event data unprocessed; callers
 * decide what to do with it (see components/NativeIntentBridge.tsx), mirroring
 * malscan-mobile/hooks/useFileIntent.ts's split between "capture" and "act".
 */
export function useShareIntent(): ShareIntent {
  const [intent, setIntent] = useState<ShareIntent>({ file: null, text: null })

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let handle: { remove: () => void } | undefined

    import("@capgo/capacitor-share-target").then(({ CapacitorShareTarget }) => {
      CapacitorShareTarget.addListener("shareReceived", (event) => {
        const file = event.files?.[0]
        if (file) {
          setIntent({ file: { uri: file.uri, name: file.name, mimeType: file.mimeType }, text: null })
        } else if (event.texts?.[0]) {
          setIntent({ file: null, text: event.texts[0] })
        }
      }).then((h) => { handle = h })
    })

    return () => handle?.remove()
  }, [])

  return intent
}
