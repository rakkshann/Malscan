import { View, Text, StyleSheet } from 'react-native'
import { COLORS, FONT } from '../constants/theme'

const HIGH_RISK_CC = new Set(['RU', 'KP', 'CN', 'IR', 'BY', 'SY'])

interface OsintSummary {
  country: string | null
  country_code: string | null
  city: string | null
  region: string | null
  hosting: string | null
  asn: string | null
  registrar: string | null
  domain_age_days: number | null
}

interface Props {
  osint: OsintSummary
}

export function GeoRisk({ osint }: Props) {
  const cc = (osint.country_code || '').toUpperCase()
  const isHighRisk = HIGH_RISK_CC.has(cc)

  const rows = [
    { label: 'COUNTRY', value: osint.country || 'Unknown', warn: isHighRisk },
    { label: 'CITY', value: [osint.city, osint.region].filter(Boolean).join(', ') || '—', warn: false },
    { label: 'ASN', value: osint.asn || '—', warn: false },
    { label: 'ISP / HOST', value: osint.hosting || '—', warn: false },
    { label: 'REGISTRAR', value: osint.registrar || '—', warn: false },
    {
      label: 'DOMAIN AGE',
      value:
        osint.domain_age_days != null
          ? osint.domain_age_days <= 30
            ? `${osint.domain_age_days} days (NEW)`
            : `${osint.domain_age_days} days`
          : '—',
      warn: (osint.domain_age_days ?? 9999) <= 30,
    },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>INFRASTRUCTURE INTELLIGENCE</Text>
        {isHighRisk && (
          <View style={styles.riskBadge}>
            <Text style={styles.riskBadgeText}>HIGH-RISK ORIGIN</Text>
          </View>
        )}
      </View>

      {rows.map(row => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={[styles.value, row.warn && styles.valueWarn]} numberOfLines={1}>
            {row.value}
          </Text>
        </View>
      ))}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionLabel: {
    fontFamily: FONT.mono,
    fontSize: 9,
    color: COLORS.text.secondary,
    letterSpacing: 3,
  },
  riskBadge: {
    backgroundColor: COLORS.verdicts.maliciousDim,
    borderWidth: 1,
    borderColor: COLORS.verdicts.maliciousBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  riskBadgeText: {
    fontFamily: FONT.mono,
    fontSize: 8,
    color: COLORS.verdicts.malicious,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderFaint,
  },
  label: {
    fontFamily: FONT.mono,
    fontSize: 9,
    color: COLORS.text.muted,
    letterSpacing: 2,
    width: 100,
  },
  value: {
    fontFamily: FONT.mono,
    fontSize: 11,
    color: COLORS.text.primary,
    flex: 1,
    textAlign: 'right',
  },
  valueWarn: {
    color: COLORS.verdicts.suspicious,
  },
})
