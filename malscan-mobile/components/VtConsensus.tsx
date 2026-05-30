import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../contexts/ThemeContext'

interface VtStats {
  malicious: number; suspicious: number; harmless: number; undetected?: number
}

export function VtConsensus({ stats }: { stats: VtStats }) {
  const { colors, fonts } = useTheme()
  const { malicious, suspicious, harmless, undetected = 0 } = stats
  const total = Math.max(malicious + suspicious + harmless + undetected, 1)

  const segments = [
    { count: malicious,  color: colors.vt.malicious,  label: 'Malicious' },
    { count: suspicious, color: colors.vt.suspicious, label: 'Suspicious' },
    { count: harmless,   color: colors.vt.harmless,   label: 'Harmless' },
    { count: undetected, color: colors.vt.undetected, label: 'Undetected' },
  ]

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border }}>
        {segments.map(s => s.count > 0 ? (
          <View key={s.label} style={{ flex: s.count / total, backgroundColor: s.color }} />
        ) : null)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {segments.map(s => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
            <Text style={{ fontFamily: fonts.heading, fontSize: 13, fontWeight: '700', color: s.color }}>{s.count}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.text.muted }}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
