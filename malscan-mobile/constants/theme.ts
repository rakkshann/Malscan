import { Platform } from 'react-native'

export const COLORS = {
  background: '#0A0A0A',
  surface: '#111111',
  surfaceRaised: '#161616',
  border: '#1E1E1E',
  borderFaint: '#141414',

  accent: '#FF3B00',
  accentDim: '#FF3B0020',
  accentBorder: '#FF3B0040',

  text: {
    primary: '#FFFFFF',
    secondary: '#888888',
    muted: '#444444',
  },

  verdicts: {
    malicious: '#FF3B00',
    maliciousDim: '#FF3B0015',
    maliciousBorder: '#FF3B0040',
    suspicious: '#F59E0B',
    suspiciousDim: '#F59E0B15',
    suspiciousBorder: '#F59E0B40',
    clear: '#22C55E',
    clearDim: '#22C55E15',
    clearBorder: '#22C55E40',
  },

  vt: {
    malicious: '#EF4444',
    suspicious: '#F59E0B',
    harmless: '#22C55E',
    undetected: '#374151',
  },
} as const

export const FONT = {
  mono: Platform.select({ android: 'monospace', ios: 'Courier New', default: 'monospace' }) as string,
} as const
