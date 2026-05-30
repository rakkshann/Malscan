import { Platform } from 'react-native'

export const FONTS = {
  heading: Platform.select({ android: 'sans-serif-medium', ios: 'System', default: 'sans-serif' }) as string,
  body:    Platform.select({ android: 'sans-serif',        ios: 'System', default: 'sans-serif' }) as string,
  mono:    Platform.select({ android: 'monospace',         ios: 'Courier New', default: 'monospace' }) as string,
} as const

// ── Palette ───────────────────────────────────────────────────────────────────
// Derived from: Glacial Tint #EBF1ED · Tropical Cyclone #B9CABE
//               Wethersfield Moss #81938A · Siberian Green #50605A
//               Carbon Fiber #2D2E2B · Dark Tone Ink #121212

const SAFE_GREEN  = '#4E9A6A'
const WARN_AMBER  = '#C49A3C'
const DANGER_RED  = '#C94040'

export interface AppColors {
  background: string
  surface: string
  surfaceRaised: string
  border: string
  borderFaint: string
  accent: string
  accentDim: string
  accentBorder: string
  text: { primary: string; secondary: string; muted: string }
  verdicts: {
    malicious: string; maliciousDim: string; maliciousBorder: string
    suspicious: string; suspiciousDim: string; suspiciousBorder: string
    clear: string; clearDim: string; clearBorder: string
  }
  vt: { malicious: string; suspicious: string; harmless: string; undetected: string }
}

export const darkColors: AppColors = {
  background:    '#121212',
  surface:       '#1C201E',
  surfaceRaised: '#272B29',
  border:        '#353A37',
  borderFaint:   '#242826',

  accent:       '#6B8C7A',
  accentDim:    '#6B8C7A18',
  accentBorder: '#6B8C7A40',

  text: {
    primary:   '#EBF1ED',
    secondary: '#B9CABE',
    muted:     '#81938A',
  },

  verdicts: {
    malicious:       DANGER_RED,
    maliciousDim:    DANGER_RED + '18',
    maliciousBorder: DANGER_RED + '45',
    suspicious:       WARN_AMBER,
    suspiciousDim:    WARN_AMBER + '18',
    suspiciousBorder: WARN_AMBER + '45',
    clear:       SAFE_GREEN,
    clearDim:    SAFE_GREEN + '18',
    clearBorder: SAFE_GREEN + '45',
  },

  vt: {
    malicious:  DANGER_RED,
    suspicious: WARN_AMBER,
    harmless:   SAFE_GREEN,
    undetected: '#50605A',
  },
}

export const lightColors: AppColors = {
  background:    '#EBF1ED',
  surface:       '#FFFFFF',
  surfaceRaised: '#D4DDD7',
  border:        '#B9CABE',
  borderFaint:   '#D4DDD7',

  accent:       '#50605A',
  accentDim:    '#50605A15',
  accentBorder: '#50605A35',

  text: {
    primary:   '#121212',
    secondary: '#2D3330',
    muted:     '#50605A',
  },

  verdicts: {
    malicious:       '#B83232',
    maliciousDim:    '#B8323215',
    maliciousBorder: '#B8323240',
    suspicious:       '#9A7520',
    suspiciousDim:    '#9A752015',
    suspiciousBorder: '#9A752040',
    clear:       '#3A7D52',
    clearDim:    '#3A7D5215',
    clearBorder: '#3A7D5240',
  },

  vt: {
    malicious:  '#B83232',
    suspicious: '#9A7520',
    harmless:   '#3A7D52',
    undetected: '#81938A',
  },
}

// Legacy export so any file that still imports COLORS/FONT keeps working
// until fully migrated. Remove after full migration.
export const COLORS = darkColors
export const FONT   = { mono: FONTS.mono }
