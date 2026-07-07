import { Platform } from 'react-native'

export const FONTS = {
  heading: Platform.select({ android: 'sans-serif-medium', ios: 'System', default: 'sans-serif' }) as string,
  body:    Platform.select({ android: 'sans-serif',        ios: 'System', default: 'sans-serif' }) as string,
  mono:    Platform.select({ android: 'monospace',         ios: 'Courier New', default: 'monospace' }) as string,
} as const

// ── Palette ───────────────────────────────────────────────────────────────────
// "Polished Trust": cool neutral surfaces + an indigo-iris brand accent. The
// accent never collides with the verdict semaphore (safe=green, suspicious=amber,
// malicious=red), which is kept by convention.

const SAFE_GREEN  = '#42BE84'   // verdict: clear / safe
const WARN_AMBER  = '#E0A23A'   // verdict: suspicious
const DANGER_RED  = '#E5575C'   // verdict: malicious

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
  background:    '#0F1116',
  surface:       '#181B22',
  surfaceRaised: '#222631',
  border:        '#2B303B',
  borderFaint:   '#1F232B',

  accent:       '#6366F1',
  accentDim:    '#6366F11F',
  accentBorder: '#6366F145',

  text: {
    primary:   '#ECEEF4',
    secondary: '#AAB0BE',
    muted:     '#6B7180',
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
    undetected: '#5A6172',
  },
}

export const lightColors: AppColors = {
  background:    '#F5F6FA',
  surface:       '#FFFFFF',
  surfaceRaised: '#EAECF3',
  border:        '#D9DCE6',
  borderFaint:   '#EAECF3',

  accent:       '#5257E0',
  accentDim:    '#5257E014',
  accentBorder: '#5257E033',

  text: {
    primary:   '#15171E',
    secondary: '#3B404C',
    muted:     '#6B7180',
  },

  verdicts: {
    malicious:       '#C5343A',
    maliciousDim:    '#C5343A15',
    maliciousBorder: '#C5343A40',
    suspicious:       '#9A7520',
    suspiciousDim:    '#9A752015',
    suspiciousBorder: '#9A752040',
    clear:       '#2E8B57',
    clearDim:    '#2E8B5715',
    clearBorder: '#2E8B5740',
  },

  vt: {
    malicious:  '#C5343A',
    suspicious: '#9A7520',
    harmless:   '#2E8B57',
    undetected: '#8A90A0',
  },
}

// Legacy export so any file that still imports COLORS/FONT keeps working
// until fully migrated. Remove after full migration.
export const COLORS = darkColors
export const FONT   = { mono: FONTS.mono }
