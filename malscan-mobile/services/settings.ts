import * as FileSystem from 'expo-file-system'
import { API_BASE_URL } from '../constants/config'

const FILE = FileSystem.documentDirectory + 'malscan_settings.json'

interface Settings {
  apiBaseUrl: string
}

const DEFAULTS: Settings = { apiBaseUrl: API_BASE_URL }

export async function loadSettings(): Promise<Settings> {
  try {
    const info = await FileSystem.getInfoAsync(FILE)
    if (!info.exists) return DEFAULTS
    const raw = await FileSystem.readAsStringAsync(FILE)
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  try {
    const current = await loadSettings()
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify({ ...current, ...patch }))
  } catch (e) {
    console.warn('[MalScan] Failed to save settings:', e)
  }
}
