import { ScrollView, StyleSheet, Text, ToastAndroid, TouchableOpacity, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { COLORS, FONT } from '../constants/theme'

interface Indicators {
  ips: string[]
  domains: string[]
  urls: string[]
}

interface Props {
  indicators: Indicators
}

type IocRow = { type: string; value: string }

async function copyIoc(value: string) {
  await Clipboard.setStringAsync(value)
  ToastAndroid.show('Copied', ToastAndroid.SHORT)
}

export function IocList({ indicators }: Props) {
  const rows: IocRow[] = [
    ...(indicators.ips     || []).map(v => ({ type: 'IPv4',   value: v })),
    ...(indicators.domains || []).map(v => ({ type: 'DOMAIN', value: v })),
    ...(indicators.urls    || []).map(v => ({ type: 'URL',    value: v })),
  ]

  return (
    <View style={styles.container}>
      <Text style={styles.header}>EXTRACTED INDICATORS (IOCs)</Text>

      {rows.length === 0 ? (
        <Text style={styles.empty}>NO NETWORK INDICATORS EXTRACTED FROM THIS ARTIFACT.</Text>
      ) : (
        <>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {rows.map((ioc, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.row, i < rows.length - 1 && styles.rowBorder]}
                onPress={() => copyIoc(ioc.value)}
                activeOpacity={0.6}
              >
                <Text style={styles.type}>{ioc.type}</Text>
                <Text style={styles.value} numberOfLines={1}>{ioc.value}</Text>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>TAP TO COPY</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.hint}>{rows.length} indicator{rows.length !== 1 ? 's' : ''} · tap any row to copy</Text>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  header: {
    fontFamily: FONT.mono,
    fontSize: 9,
    color: COLORS.text.secondary,
    letterSpacing: 3,
    marginBottom: 14,
  },
  empty: {
    fontFamily: FONT.mono,
    fontSize: 10,
    color: COLORS.text.muted,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: 20,
  },
  scroll: { maxHeight: 220 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  type: {
    fontFamily: FONT.mono,
    fontSize: 9,
    color: COLORS.accent,
    letterSpacing: 2,
    width: 52,
  },
  value: {
    fontFamily: FONT.mono,
    fontSize: 11,
    color: COLORS.text.primary,
    flex: 1,
  },
  tag: { backgroundColor: '#FFFFFF10', paddingHorizontal: 6, paddingVertical: 3 },
  tagText: { fontFamily: FONT.mono, fontSize: 8, color: COLORS.text.secondary, letterSpacing: 1 },
  hint: {
    fontFamily: FONT.mono,
    fontSize: 8,
    color: COLORS.text.muted,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 10,
  },
})
