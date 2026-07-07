import { ScrollView, Text, ToastAndroid, TouchableOpacity, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useTheme } from '../contexts/ThemeContext'

interface Indicators { ips: string[]; domains: string[]; urls: string[] }

async function copyIoc(value: string) {
  await Clipboard.setStringAsync(value)
  ToastAndroid.show('Copied', ToastAndroid.SHORT)
}

export function IocList({ indicators }: { indicators: Indicators }) {
  const { colors, fonts } = useTheme()

  const rows = [
    ...(indicators.ips     || []).map(v => ({ type: 'IP',     value: v })),
    ...(indicators.domains || []).map(v => ({ type: 'Domain', value: v })),
    ...(indicators.urls    || []).map(v => ({ type: 'URL',    value: v })),
  ]

  if (rows.length === 0) {
    return (
      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.text.muted, textAlign: 'center', paddingVertical: 12 }}>
        No network indicators found in this file.
      </Text>
    )
  }

  return (
    <View style={{ gap: 2 }}>
      <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {rows.map((ioc, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => copyIoc(ioc.value)}
            activeOpacity={0.6}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: colors.borderFaint }}
          >
            <View style={{ backgroundColor: colors.accent + '25', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.accent }}>{ioc.type}</Text>
            </View>
            <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.text.primary, flex: 1 }} numberOfLines={1}>{ioc.value}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.text.muted, textAlign: 'center', marginTop: 6 }}>
        {rows.length} indicator{rows.length !== 1 ? 's' : ''} · tap to copy
      </Text>
    </View>
  )
}
