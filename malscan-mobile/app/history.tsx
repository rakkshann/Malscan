import { useCallback, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { clearHistory, getHistory, ScanSummary } from '../services/history'
import { COLORS, FONT } from '../constants/theme'

function verdictColor(verdict: ScanSummary['verdict']): string {
  if (verdict === 'Malicious') return COLORS.verdicts.malicious
  if (verdict === 'Suspicious') return COLORS.verdicts.suspicious
  return COLORS.verdicts.clear
}

function HistoryCard({ item }: { item: ScanSummary }) {
  const color = verdictColor(item.verdict)
  const date = new Date(item.scannedAt)
  const dateStr = date.toLocaleDateString() + '  ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.target} numberOfLines={1}>{item.target}</Text>
        <View style={[styles.badge, { borderColor: color + '40', backgroundColor: color + '18' }]}>
          <Text style={[styles.badgeText, { color }]}>{item.verdict.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.meta}>SCORE {item.score}/100</Text>
        <Text style={styles.meta}>{item.family}</Text>
        <Text style={styles.date}>{dateStr}</Text>
      </View>
    </View>
  )
}

export default function HistoryScreen() {
  const [history, setHistory] = useState<ScanSummary[]>([])

  useFocusEffect(useCallback(() => {
    getHistory().then(setHistory)
  }, []))

  const handleClear = () => {
    Alert.alert(
      'Clear History',
      'Remove all past scan records from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => clearHistory().then(() => setHistory([])),
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SCAN HISTORY</Text>
        <TouchableOpacity
          style={[styles.clearBtn, history.length === 0 && styles.clearBtnDisabled]}
          onPress={handleClear}
          disabled={history.length === 0}
        >
          <Text style={[styles.clearBtnText, history.length === 0 && styles.clearBtnTextDisabled]}>
            CLEAR
          </Text>
        </TouchableOpacity>
      </View>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyGlyph}>◎</Text>
          <Text style={styles.emptyTitle}>NO SCAN HISTORY</Text>
          <Text style={styles.emptySub}>Completed scans will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.jobId}
          renderItem={({ item }) => <HistoryCard item={item} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            <Text style={styles.listCount}>{history.length} RECORD{history.length !== 1 ? 'S' : ''}</Text>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 6 },
  backBtnText: { fontFamily: FONT.mono, fontSize: 10, color: COLORS.text.secondary, letterSpacing: 2 },
  title: { fontFamily: FONT.mono, fontSize: 12, fontWeight: 'bold', color: COLORS.text.primary, letterSpacing: 4 },
  clearBtn: { borderWidth: 1, borderColor: COLORS.verdicts.maliciousBorder, paddingHorizontal: 12, paddingVertical: 6 },
  clearBtnDisabled: { borderColor: COLORS.border },
  clearBtnText: { fontFamily: FONT.mono, fontSize: 10, color: COLORS.verdicts.malicious, letterSpacing: 2 },
  clearBtnTextDisabled: { color: COLORS.text.muted },

  list: { padding: 16, paddingTop: 12 },
  listCount: {
    fontFamily: FONT.mono,
    fontSize: 9,
    color: COLORS.text.muted,
    letterSpacing: 2,
    marginBottom: 12,
  },

  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 14,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  target: { fontFamily: FONT.mono, fontSize: 11, color: COLORS.text.primary, flex: 1 },
  badge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: FONT.mono, fontSize: 8, letterSpacing: 1 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  meta: { fontFamily: FONT.mono, fontSize: 9, color: COLORS.text.muted, letterSpacing: 1 },
  date: { fontFamily: FONT.mono, fontSize: 9, color: COLORS.text.muted, marginLeft: 'auto' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyGlyph: { fontSize: 36, color: COLORS.text.muted },
  emptyTitle: { fontFamily: FONT.mono, fontSize: 14, color: COLORS.text.secondary, letterSpacing: 4 },
  emptySub: { fontFamily: FONT.mono, fontSize: 10, color: COLORS.text.muted, letterSpacing: 1 },
})
