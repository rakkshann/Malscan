import jsPDF from "jspdf"

/**
 * Builds the PDF from real screenshots of the rendered report (sliced across
 * pages) rather than redrawing the data from scratch — that earlier approach
 * lost the actual visual identity (URLScan sandbox image, dark IOC terminal,
 * map HUD) and had its own pagination bugs. This captures exactly what's on
 * screen, the same way the map's own print snapshot already works.
 *
 * Captured at a fixed simulated viewport width (see CAPTURE_WIDTH) regardless
 * of the real window/WebView width, so the layout — and therefore the PDF —
 * is consistent whether this runs on a desktop browser or a narrow phone.
 */
const CAPTURE_WIDTH = 860
const PAGE_BG = "#F5F5F3"

/**
 * The URLScan sandbox screenshot is hosted on urlscan.io, a different origin.
 * html2canvas silently skips (leaves blank) any cross-origin image it can't
 * verify is CORS-safe — which is exactly the blank box that showed up in the
 * exported PDF even though the rest of the page captured fine. Fetching the
 * image ourselves and swapping the <img> to a data URL sidesteps that, since
 * a data URL has no origin to taint the canvas with. Restored afterward so
 * the live page's behavior is untouched if anything here fails.
 */
async function inlineCrossOriginImages(root: HTMLElement): Promise<() => void> {
  const imgs = Array.from(root.querySelectorAll("img")).filter((img) => {
    try {
      return new URL(img.src, window.location.href).origin !== window.location.origin
    } catch {
      return false
    }
  })

  const restores: (() => void)[] = []
  await Promise.all(
    imgs.map(async (img) => {
      const originalSrc = img.src
      try {
        const res = await fetch(originalSrc, { mode: "cors" })
        const blob = await res.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        img.src = dataUrl
        restores.push(() => { img.src = originalSrc })
      } catch {
        // Couldn't fetch it CORS-safe either — leave it as-is, capture will
        // just skip it like before rather than blocking the whole export.
      }
    })
  )

  return () => restores.forEach((restore) => restore())
}

/** Trims fully-blank trailing rows from the bottom of the capture so a stray
 * margin/padding doesn't turn into an entire wasted blank PDF page. */
function trimTrailingBlankRows(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  const bg = (() => {
    const probe = document.createElement("canvas").getContext("2d")
    if (!probe) return [245, 245, 243]
    probe.fillStyle = PAGE_BG
    probe.fillRect(0, 0, 1, 1)
    return Array.from(probe.getImageData(0, 0, 1, 1).data.slice(0, 3))
  })()

  const sampleCols = 24
  const tolerance = 6
  let lastContentRow = 0

  for (let y = canvas.height - 1; y >= 0; y--) {
    const row = ctx.getImageData(0, y, canvas.width, 1).data
    let blank = true
    for (let i = 0; i < sampleCols; i++) {
      const x = Math.floor((i / sampleCols) * canvas.width)
      const offset = x * 4
      if (
        Math.abs(row[offset] - bg[0]) > tolerance ||
        Math.abs(row[offset + 1] - bg[1]) > tolerance ||
        Math.abs(row[offset + 2] - bg[2]) > tolerance
      ) {
        blank = false
        break
      }
    }
    if (!blank) { lastContentRow = y; break }
  }

  const trimmedHeight = Math.min(canvas.height, lastContentRow + 32)
  if (trimmedHeight >= canvas.height - 4) return canvas // nothing meaningful to trim

  const trimmed = document.createElement("canvas")
  trimmed.width = canvas.width
  trimmed.height = trimmedHeight
  trimmed.getContext("2d")?.drawImage(canvas, 0, 0)
  return trimmed
}

export async function generateReportPdfFromElement(el: HTMLElement, jobId: string): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas-pro")

  const restoreImages = await inlineCrossOriginImages(el)
  let rawCanvas: HTMLCanvasElement
  try {
    rawCanvas = await html2canvas(el, {
      useCORS: true,
      backgroundColor: PAGE_BG,
      windowWidth: CAPTURE_WIDTH,
      width: CAPTURE_WIDTH,
      scale: 1.5,
    })
  } finally {
    restoreImages()
  }

  const canvas = trimTrailingBlankRows(rawCanvas)

  const doc = new jsPDF({ unit: "pt", format: "letter" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // Map the captured canvas (CAPTURE_WIDTH * scale px wide) onto the PDF's
  // page width, then slice it into page-height bands — each band becomes one
  // PDF page so nothing gets stretched, squashed, or cut mid-section by luck.
  const pxPerPt = canvas.width / pageW
  const sliceHeightPx = Math.floor(pageH * pxPerPt)

  let renderedPx = 0
  let pageIndex = 0
  while (renderedPx < canvas.height) {
    const sliceH = Math.min(sliceHeightPx, canvas.height - renderedPx)

    const sliceCanvas = document.createElement("canvas")
    sliceCanvas.width = canvas.width
    sliceCanvas.height = sliceH
    const ctx = sliceCanvas.getContext("2d")
    if (!ctx) break
    ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH)

    if (pageIndex > 0) doc.addPage()
    doc.addImage(sliceCanvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageW, (sliceH / pxPerPt))

    renderedPx += sliceH
    pageIndex++
  }

  // Footer on every page, drawn after the content image so it sits on top.
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFillColor(255, 255, 255)
    doc.rect(0, pageH - 20, pageW, 20, "F")
    doc.setFillColor(255, 59, 0)
    doc.rect(28, pageH - 12, 4, 4, "F")
    doc.setFont("courier", "normal")
    doc.setFontSize(7)
    doc.setTextColor(107, 114, 128)
    doc.text("MALSCAN AUTOMATED THREAT INTELLIGENCE", 36, pageH - 9)
    doc.text(`JOB ${jobId.slice(0, 8)} · PAGE ${p} OF ${pageCount}`, pageW - 28, pageH - 9, { align: "right" })
  }

  return doc.output("blob")
}
