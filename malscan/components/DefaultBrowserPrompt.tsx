"use client"

import { useEffect, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { ShieldAlert, X } from "lucide-react"
import DefaultBrowser from "../lib/native/defaultBrowser"

const SEEN_KEY = "malscan_seen_default_browser_prompt"

/**
 * One-time onboarding prompt asking the user to make MalScan the default
 * browser, so accidental link taps in WhatsApp etc. get scanned first. Shown
 * once per install; also re-triggerable any time from Settings.
 */
export function DefaultBrowserPrompt() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (typeof window === "undefined") return
    if (window.localStorage.getItem(SEEN_KEY)) return

    DefaultBrowser.isRoleAvailable().then(({ value: available }) => {
      if (!available) return
      DefaultBrowser.isDefaultBrowser().then(({ value: isDefault }) => {
        if (!isDefault) setVisible(true)
      })
    })
  }, [])

  const dismiss = () => {
    window.localStorage.setItem(SEEN_KEY, "1")
    setVisible(false)
  }

  const handleAccept = async () => {
    try {
      await DefaultBrowser.requestRole()
    } finally {
      dismiss()
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-6">
      <div className="relative w-full max-w-sm bg-white border-2 border-[#121212] p-6">
        <button onClick={dismiss} className="absolute top-3 right-3 text-gray-400 hover:text-[#121212]">
          <X size={16} />
        </button>
        <ShieldAlert className="w-10 h-10 text-[#FF3B00] mb-4" />
        <h2 className="text-lg font-medium tracking-tight mb-2">Protect link taps?</h2>
        <p className="font-mono text-xs text-gray-500 leading-relaxed mb-6">
          Set MalScan as your default browser so links you accidentally tap in
          WhatsApp or other apps get checked here first, before they open.
        </p>
        <div className="flex gap-3">
          <button
            onClick={dismiss}
            className="flex-1 py-3 border border-gray-300 font-mono text-[10px] tracking-widest uppercase text-gray-500 hover:border-[#121212] transition-colors"
          >
            Not Now
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 py-3 bg-[#121212] text-white font-mono text-[10px] tracking-widest uppercase hover:bg-[#FF3B00] transition-colors"
          >
            Set as Default
          </button>
        </div>
      </div>
    </div>
  )
}
