import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { uploadFile, submitUrl } from '../services/api'
import { useScanPoller } from '../hooks/useScanPoller'
import { addToHistory } from '../services/history'
import { useTheme } from '../contexts/ThemeContext'

const PHASES: { label: string; detail: string }[] = [
  { label: 'Preparing',               detail: 'Setting up a secure environment' },
  { label: 'Fingerprinting',          detail: 'Creating a unique hash of the file' },
  { label: 'Content scan',            detail: 'Looking for suspicious links and patterns' },
  { label: 'Structure analysis',      detail: 'Examining the file\'s internal structure' },
  { label: 'Threat database',         detail: 'Checking against known malware signatures' },
  { label: 'Security engines',        detail: 'Verifying with 70+ security vendors' },
  { label: 'Sandbox test',            detail: 'Testing in an isolated environment' },
  { label: 'Domain check',            detail: 'Investigating domain ownership' },
  { label: 'Network records',         detail: 'Checking DNS and network infrastructure' },
  { label: 'Location mapping',        detail: 'Locating associated servers' },
  { label: 'Threat attribution',      detail: 'Identifying known threat actors' },
  { label: 'Risk calculation',        detail: 'Calculating your safety score' },
  { label: 'Cross-referencing',       detail: 'Comparing with previous scans' },
  { label: 'Report generation',       detail: 'Preparing your detailed report' },
]

export default function ScanningScreen() {
  const { colors, fonts } = useTheme()
  const { uri, url, filename, source, mimeType } = useLocalSearchParams<{
    uri?: string; url?: string; filename?: string; source?: string; mimeType?: string
  }>()

  const [jobId, setJobId]   = useState<string | null>(null)
  const [phase, setPhase]   = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError]   = useState<string | null>(null)
  const [done, setDone]     = useState(false)

  const phaseTimer   = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const s = makeStyles(colors, fonts)

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(0)).current
  const progress = Math.min(((phase + 1) / PHASES.length) * 100, done ? 100 : 95)

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progress, duration: 400, useNativeDriver: false }).start()
  }, [progress])

  // Phase cycling
  useEffect(() => {
    phaseTimer.current   = setInterval(() => setPhase(p => Math.min(p + 1, PHASES.length - 1)), 2200)
    elapsedTimer.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => {
      if (phaseTimer.current)   clearInterval(phaseTimer.current)
      if (elapsedTimer.current) clearInterval(elapsedTimer.current)
    }
  }, [])

  // Upload
  useEffect(() => {
    const start = async () => {
      try {
        let id: string
        if (uri)       id = await uploadFile(uri, filename || 'scan_target')
        else if (url)  id = await submitUrl(url)
        else { setError('No file or URL provided.'); return }
        setJobId(id)
      } catch (e: any) {
        const msg = e?.response?.data?.detail || e?.message || 'Upload failed.'
        setError(`${msg}\n\nIs the backend running? Check Settings.`)
      }
    }
    start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll
  const scanResult = useScanPoller(jobId)
  useEffect(() => {
    if (!scanResult) return
    if (scanResult.status === 'Completed' && !done) {
      setDone(true)
      if (phaseTimer.current)   clearInterval(phaseTimer.current)
      if (elapsedTimer.current) clearInterval(elapsedTimer.current)
      const r = scanResult.results
      if (r) {
        addToHistory({ jobId: scanResult.job_id, target: filename || url || uri || 'Unknown',
          verdict: r.verdict, score: r.score, family: r.family || 'Unknown', scannedAt: new Date().toISOString() })
      }
      setTimeout(() => router.replace({
        pathname: '/verdict',
        params: { jobId: scanResult.job_id, originalUri: uri || '', mimeType: mimeType || '' },
      }), 600)
    }
    if (scanResult.status === 'Failed') setError('The scan engine encountered an error. Please try again.')
  }, [scanResult]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentPhase = PHASES[Math.min(phase, PHASES.length - 1)]

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Scanning</Text>
          <View style={[s.statusPill, error ? s.pillError : done ? s.pillDone : s.pillActive]}>
            <Text style={s.pillText}>{error ? 'Error' : done ? 'Done' : 'In progress'}</Text>
          </View>
        </View>

        {/* Shield */}
        <View style={s.shieldWrap}>
          <View style={s.shieldCircle}>
            <Text style={s.shieldGlyph}>🛡</Text>
          </View>
          <Text style={s.analysingText}>Analysing your file</Text>
          <Text style={s.sourceText}>
            {source === 'intent' || source === 'share'
              ? 'Received from another app'
              : 'Selected from device'}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={s.progressTrack}>
          <Animated.View
            style={[s.progressFill, {
              width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
              backgroundColor: error ? colors.verdicts.malicious : colors.accent,
            }]}
          />
        </View>
        <View style={s.progressMeta}>
          <Text style={s.progressPct}>{Math.round(progress)}%</Text>
          <Text style={s.progressTime}>{elapsed}s elapsed</Text>
        </View>

        {/* Current phase */}
        {!error ? (
          <View style={s.phaseCard}>
            <Text style={s.phaseLabel}>{currentPhase.label}</Text>
            <Text style={s.phaseDetail}>{currentPhase.detail}</Text>
          </View>
        ) : (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>Something went wrong</Text>
            <Text style={s.errorBody}>{error}</Text>
          </View>
        )}

        {/* Job info */}
        {jobId && !error && (
          <View style={s.infoCard}>
            <View style={s.infoRow}>
              <Text style={s.infoKey}>File</Text>
              <Text style={s.infoVal} numberOfLines={1}>{filename || url || 'Unknown'}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoKey}>Status</Text>
              <Text style={s.infoVal}>{scanResult?.status ?? 'Submitted'}</Text>
            </View>
          </View>
        )}

        {/* Phase steps — simple dots */}
        <View style={s.dots}>
          {PHASES.map((_, i) => (
            <View
              key={i}
              style={[s.dot, i <= phase && !error && s.dotActive, done && s.dotDone]}
            />
          ))}
        </View>

      </View>

      {/* Bottom bar */}
      <View style={[s.bottomBar, error && s.bottomBarError]}>
        {error ? (
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.bottomBarText}>← Go back and try again</Text>
          </TouchableOpacity>
        ) : (
          <Text style={s.bottomBarText}>Please keep the app open during scanning</Text>
        )}
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any, fonts: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  headerTitle: { fontFamily: fonts.heading, fontSize: 20, fontWeight: '700', color: colors.text.primary },
  statusPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  pillActive: { backgroundColor: colors.verdicts.suspiciousDim },
  pillDone:   { backgroundColor: colors.verdicts.clearDim },
  pillError:  { backgroundColor: colors.verdicts.maliciousDim },
  pillText: { fontFamily: fonts.body, fontSize: 12, color: colors.text.secondary },

  shieldWrap: { alignItems: 'center', marginBottom: 36 },
  shieldCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, elevation: 4,
  },
  shieldGlyph: { fontSize: 48 },
  analysingText: { fontFamily: fonts.heading, fontSize: 22, fontWeight: '700', color: colors.text.primary, marginBottom: 4 },
  sourceText: { fontFamily: fonts.body, fontSize: 13, color: colors.text.muted },

  progressTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  progressPct: { fontFamily: fonts.body, fontSize: 13, color: colors.text.secondary },
  progressTime: { fontFamily: fonts.body, fontSize: 13, color: colors.text.muted },

  phaseCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: colors.border, marginBottom: 14, elevation: 1,
  },
  phaseLabel: { fontFamily: fonts.heading, fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: 4 },
  phaseDetail: { fontFamily: fonts.body, fontSize: 13, color: colors.text.muted },

  errorCard: {
    backgroundColor: colors.verdicts.maliciousDim, borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: colors.verdicts.maliciousBorder, marginBottom: 14,
  },
  errorTitle: { fontFamily: fonts.heading, fontSize: 15, fontWeight: '600', color: colors.verdicts.malicious, marginBottom: 6 },
  errorBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text.secondary, lineHeight: 20 },

  infoCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 20, gap: 8,
  },
  infoRow: { flexDirection: 'row', gap: 10 },
  infoKey: { fontFamily: fonts.body, fontSize: 12, color: colors.text.muted, width: 48 },
  infoVal: { fontFamily: fonts.body, fontSize: 12, color: colors.text.secondary, flex: 1 },

  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent },
  dotDone:   { backgroundColor: colors.verdicts.clear },

  bottomBar: {
    paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center',
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  bottomBarError: { backgroundColor: colors.verdicts.maliciousDim, borderTopColor: colors.verdicts.maliciousBorder },
  bottomBarText: { fontFamily: fonts.body, fontSize: 13, color: colors.text.muted, textAlign: 'center' },
})
