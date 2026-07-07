import * as FileSystem from 'expo-file-system'

const FILE = FileSystem.documentDirectory + 'malscan_history.json'
const MAX_ENTRIES = 50

export interface ScanSummary {
  jobId: string
  target: string
  verdict: 'Malicious' | 'Suspicious' | 'Clear'
  score: number
  family: string
  scannedAt: string  // ISO string
}

export async function getHistory(): Promise<ScanSummary[]> {
  try {
    const info = await FileSystem.getInfoAsync(FILE)
    if (!info.exists) return []
    const raw = await FileSystem.readAsStringAsync(FILE)
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export async function addToHistory(entry: ScanSummary): Promise<void> {
  try {
    const current = await getHistory()
    const updated = [entry, ...current.filter(e => e.jobId !== entry.jobId)].slice(0, MAX_ENTRIES)
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(updated))
  } catch (e) {
    console.warn('[MalScan] Failed to write history:', e)
  }
}

export async function removeFromHistory(jobId: string): Promise<void> {
  try {
    const current = await getHistory()
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(current.filter(e => e.jobId !== jobId)))
  } catch (e) {
    console.warn('[MalScan] Failed to remove history entry:', e)
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await FileSystem.deleteAsync(FILE, { idempotent: true })
  } catch (e) {
    console.warn('[MalScan] Failed to clear history:', e)
  }
}
