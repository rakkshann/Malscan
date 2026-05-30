import { useCallback, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { clearHistory, getHistory, ScanSummary } from '../services/history'
import { useTheme } from '../contexts/ThemeContext'

function VerdictBadge({ verdict, colors, fonts }: { verdict: ScanSummary['verdict']; colors: any; fonts: any }) {
  const color =
    verdict === 'Malicious' ? colors.verdicts.malicious
    : verdict === 'Suspicious' ? colors.verdicts.suspicious
    : colors.verdicts.clear
  const label = verdict === 'Clear' ? 'Safe' : verdict
  return (
    <View style={{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: color + '20', borderWidth: 1, borderColor: color + '40' }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 11, color, fontWeight: '600' }}>{label}</Text>
    </View>
  )
}

function HistoryCard({ item, colors, fonts }: { item: ScanSummary; colors: any; fonts: any }) {
  const date = new Date(item.scannedAt)
  const dateStr = date.toLocaleDateString() + '  ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <TouchableOpacity
      style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10, elevation: 1 }}
      onPress={() => router.push({ pathname: '/verdict', params: { jobId: item.jobId } })}
      activeOpacity={0.75}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.text.primary, flex: 1 }} numberOfLines={1}>{item.target}</Text>
        <VerdictBadge verdict={item.verdict} colors={colors} fonts={fonts} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.text.muted }}>Score {item.score}/100</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.text.muted }}>{item.family}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.text.muted, marginLeft: 'auto' }}>{dateStr}</Text>
      </View>
    </TouchableOpacity>
  )
}

export default function HistoryScreen() {
  const { colors, fonts } = useTheme()
  const [history, setHistory] = useState<ScanSummary[]>([])
  const s = makeStyles(colors, fonts)

  useFocusEffect(useCallback(() => { getHistory().then(setHistory) }, []))

  const handleClear = () => {
    Alert.alert('Clear History', 'Remove all past scan records?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: () => clearHistory().then(() => setHistory([])) },
    ])
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Scan History</Text>
        <TouchableOpacity onPress={handleClear} disabled={history.length === 0}>
          <Text style={[s.clearText, history.length === 0 && { opacity: 0.3 }]}>Clear</Text>
        </TouchableOpacity>
      </View>

      {history.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyGlyph}>🕐</Text>
          <Text style={s.emptyTitle}>No scans yet</Text>
          <Text style={s.emptySub}>Your scan history will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={i => i.jobId}
          renderItem={({ item }) => <HistoryCard item={item} colors={colors} fonts={fonts} />}
          contentContainerStyle={{ padding: 20, gap: 10 }}
          ListHeaderComponent={<Text style={s.count}>{history.length} scan{history.length !== 1 ? 's' : ''}</Text>}
        />
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: any, fonts: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  backBtnText: { fontFamily: fonts.body, fontSize: 13, color: colors.text.secondary },
  title: { fontFamily: fonts.heading, fontSize: 17, fontWeight: '700', color: colors.text.primary },
  clearText: { fontFamily: fonts.body, fontSize: 14, color: colors.verdicts.malicious },
  count: { fontFamily: fonts.body, fontSize: 12, color: colors.text.muted, marginBottom: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyGlyph: { fontSize: 48 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 18, fontWeight: '600', color: colors.text.secondary },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.text.muted },
})
