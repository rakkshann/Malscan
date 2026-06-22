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

  // Plain-language takeaway. Note: for files, engines never vote "harmless" —
  // "undetected" IS the clean result, which confuses people without this line.
  const headline =
    malicious > 0  ? { text: `${malicious} of ${total} engines flagged this as malicious`, color: colors.vt.malicious }
    : suspicious > 0 ? { text: `${suspicious} of ${total} engines marked this suspicious`, color: colors.vt.suspicious }
    : { text: `Clean — 0 of ${total} engines flagged this`, color: colors.vt.harmless }

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontFamily: fonts.heading, fontSize: 14, fontWeight: '600', color: headline.color }}>
        {headline.text}
      </Text>
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
      {undetected > 0 && malicious === 0 && suspicious === 0 && (
        <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.text.muted }}>
          "Undetected" means the engine scanned this and found nothing — it is the normal clean result for files.
        </Text>
      )}
    </View>
  )
}
