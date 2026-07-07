import { Capacitor } from "@capacitor/core"

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Strip the "data:<mime>;base64," prefix — Filesystem.writeFile wants raw base64.
      resolve(result.split(",")[1] || "")
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Saves a Blob to disk and opens the OS share sheet (native), or triggers a
 * normal browser download (web). window.print()'s "Save as PDF" — the
 * previous export mechanism — does nothing inside an Android WebView; there's
 * no native print handler wired up, unlike a real browser. This works on both.
 */
export async function saveAndShareBlob(blob: Blob, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem")
    const { Share } = await import("@capacitor/share")
    const base64 = await blobToBase64(blob)
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    })
    await Share.share({ title: filename, url: result.uri })
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
