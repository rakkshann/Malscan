import { View, Text, StyleSheet } from 'react-native'
import { COLORS, FONT } from '../constants/theme'

interface VtStats {
  malicious: number
  suspicious: number
  harmless: number
  undetected?: number
}

interface Props {
  stats: VtStats
}

export function VtConsensus({ stats }: Props) {
  const { malicious, suspicious, harmless, undetected = 0 } = stats
  const total = Math.max(malicious + suspicious + harmless + undetected, 1)

  const segments = [
    { count: malicious, color: COLORS.vt.malicious, label: 'Malicious' },
    { count: suspicious, color: COLORS.vt.suspicious, label: 'Suspicious' },
    { count: harmless, color: COLORS.vt.harmless, label: 'Harmless' },
    { count: undetected, color: COLORS.vt.undetected, label: 'Undetected' },
  ]

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>VIRUSTOTAL VENDOR CONSENSUS</Text>

      {/* Segmented bar */}
      <View style={styles.bar}>
        {segments.map(s =>
          s.count > 0 ? (
            <View
              key={s.label}
              style={[styles.segment, { flex: s.count / total, backgroundColor: s.color }]}
            />
          ) : null,
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {segments.map(s => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={[styles.legendCount, { color: s.color }]}>{s.count}</Text>
            <Text style={styles.legendLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 16,
  },
  sectionLabel: {
    fontFamily: FONT.mono,
    fontSize: 9,
    color: COLORS.text.secondary,
    letterSpacing: 3,
    marginBottom: 12,
  },
  bar: {
    flexDirection: 'row',
    height: 6,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  segment: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
  },
  legendCount: {
    fontFamily: FONT.mono,
    fontSize: 11,
    fontWeight: 'bold',
  },
  legendLabel: {
    fontFamily: FONT.mono,
    fontSize: 9,
    color: COLORS.text.secondary,
    letterSpacing: 1,
  },
})
