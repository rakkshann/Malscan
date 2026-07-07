import { View, Text } from 'react-native'
import { useTheme } from '../contexts/ThemeContext'

const HIGH_RISK_CC = new Set(['RU', 'KP', 'CN', 'IR', 'BY', 'SY'])

interface OsintSummary {
  country: string | null; country_code: string | null; city: string | null
  region: string | null; hosting: string | null; asn: string | null
  registrar: string | null; domain_age_days: number | null
}

export function GeoRisk({ osint }: { osint: OsintSummary }) {
  const { colors, fonts } = useTheme()
  const cc = (osint.country_code || '').toUpperCase()
  const isHighRisk = HIGH_RISK_CC.has(cc)

  const rows = [
    { label: 'Country', value: osint.country || '—', warn: isHighRisk },
    { label: 'City', value: [osint.city, osint.region].filter(Boolean).join(', ') || '—', warn: false },
    { label: 'ASN', value: osint.asn || '—', warn: false },
    { label: 'Hosting', value: osint.hosting || '—', warn: false },
    { label: 'Registrar', value: osint.registrar || '—', warn: false },
    {
      label: 'Domain age',
      value: osint.domain_age_days != null
        ? osint.domain_age_days <= 30 ? `${osint.domain_age_days} days (very new)` : `${osint.domain_age_days} days`
        : '—',
      warn: (osint.domain_age_days ?? 9999) <= 30,
    },
  ]

  return (
    <View style={{ gap: 8 }}>
      {isHighRisk && (
        <View style={{ backgroundColor: colors.verdicts.maliciousDim, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.verdicts.maliciousBorder }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.verdicts.malicious, fontWeight: '600' }}>
            ⚠️ Infrastructure located in a high-risk country
          </Text>
        </View>
      )}
      {rows.map(row => (
        <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderFaint }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.text.muted, width: 90 }}>{row.label}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: row.warn ? colors.verdicts.suspicious : colors.text.primary, flex: 1, textAlign: 'right' }} numberOfLines={1}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  )
}
