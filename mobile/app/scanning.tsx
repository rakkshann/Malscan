import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { uploadFile, submitUrl, describeApiError } from '../services/api'
import { useScanPoller } from '../hooks/useScanPoller'
import { addToHistory } from '../services/history'
import { useTheme } from '../contexts/ThemeContext'
import { ShieldIcon } from '../components/ShieldIcon'

// A scan that has produced nothing after this long is stuck — surface an error
// instead of spinning forever (e.g. backend died mid-job).
const SCAN_TIMEOUT_MS = 4 * 60 * 1000

// Phase labels mirror the real backend pipeline stages (static analysis →
// threat-intel lookups → OSINT enrichment → scoring → clustering → report).
const FILE_PHASES: { label: string; detail: string }[] = [
  { label: 'Preparing',               detail: 'Securing a working copy of the file' },
  { label: 'Fingerprinting',          detail: 'Computing the SHA-256 hash' },
  { label: 'Content scan',            detail: 'Extracting links, IPs and suspicious strings' },
  { label: 'Structure analysis',      detail: 'Inspecting the file\'s internal structure' },
  { label: 'Document inspection',     detail: 'Checking for macros, scripts and auto-actions' },
  { label: 'Signature rules',         detail: 'Matching against YARA threat signatures' },
  { label: 'Threat databases',        detail: 'Querying MalwareBazaar and ThreatFox' },
  { label: 'Antivirus consensus',     detail: 'Checking 60+ engines via VirusTotal' },
  { label: 'Network indicators',      detail: 'Investigating any embedded servers and domains' },
  { label: 'Risk calculation',        detail: 'Weighing all the evidence into one score' },
  { label: 'Cross-referencing',       detail: 'Comparing with previous scans' },
  { label: 'Report generation',       detail: 'Preparing your detailed report' },
]

const URL_PHASES: { label: string; detail: string }[] = [
  { label: 'Preparing',               detail: 'Parsing and normalising the link' },
  { label: 'Link analysis',           detail: 'Checking for impersonation and lookalike tricks' },
  { label: 'Threat databases',        detail: 'Querying URLhaus and ThreatFox' },
  { label: 'Domain ownership',        detail: 'Looking up WHOIS registration records' },
  { label: 'Network records',         detail: 'Resolving DNS and infrastructure data' },
  { label: 'Location mapping',        detail: 'Locating the hosting servers' },
  { label: 'Sandbox visit',           detail: 'Loading the page safely via URLScan.io' },
  { label: 'Antivirus consensus',     detail: 'Checking 60+ engines via VirusTotal' },
  { label: 'Risk calculation',        detail: 'Weighing all the evidence into one score' },
  { label: 'Cross-referencing',       detail: 'Comparing with previous scans' },
  { label: 'Report generation',       detail: 'Preparing your detailed report' },
]

export default function ScanningScreen() {
  const { colors, fonts } = useTheme()
  const { uri, url, filename, source, mimeType } = useLocalSearchParams<{
    uri?: string; url?: string; filename?: string; source?: string; mimeType?: string
  }>()

  const [jobId, setJobId]     = useState<string | null>(null)
  const [phase, setPhase]     = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError]     = useState<string | null>(null)
  const [done, setDone]       = useState(false)
  // Bumping runId restarts the whole upload + timer pipeline (Try Again).
  const [runId, setRunId]     = useState(0)

  const s = makeStyles(colors, fonts)
  const phases = url ? URL_PHASES : FILE_PHASES

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(0)).current
  const progress = done ? 100 : Math.min(((phase + 1) / phases.length) * 100, 95)

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progress, duration: 400, useNativeDriver: false }).start()
  }, [progress])

  // Phase cycling, elapsed clock, and stuck-scan watchdog — all stop on done/error
  useEffect(() => {
    if (done || error) return
    const phaseTimer   = setInterval(() => setPhase(p => Math.min(p + 1, phases.length - 1)), 2200)
    const elapsedTimer = setInterval(() => setElapsed(e => e + 1), 1000)
    const watchdog     = setTimeout(() => {
      setError('The scan is taking much longer than expected. The engine may be stuck — please try again.')
    }, SCAN_TIMEOUT_MS)
    return () => {
      clearInterval(phaseTimer)
      clearInterval(elapsedTimer)
      clearTimeout(watchdog)
    }
  }, [runId, done, error])

  // Upload
  useEffect(() => {
    let cancelled = false
    const start = async () => {
      try {
        let id: string
        if (uri)       id = await uploadFile(uri, filename || 'scan_target')
        else if (url)  id = await submitUrl(url)
        else { setError('No file or URL provided.'); return }
        if (!cancelled) setJobId(id)
      } catch (e: any) {
        if (!cancelled) setError(describeApiError(e))
      }
    }
    start()
    return () => { cancelled = true }
  }, [runId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll
  const scanResult = useScanPoller(jobId)
  useEffect(() => {
    if (!scanResult) return
    if (scanResult.status === 'Completed' && !done) {
      setDone(true)
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
    if (scanResult.status === 'Failed') setError('The scan engine encountered an error while analysing this file. Please try again.')
  }, [scanResult]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    setError(null)
    setJobId(null)
    setPhase(0)
    setElapsed(0)
    setDone(false)
    setRunId(r => r + 1)
  }

  const currentPhase = phases[Math.min(phase, phases.length - 1)]
  const targetName = filename || url || 'Unknown target'

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
            <ShieldIcon
              size={50}
              color={error ? colors.verdicts.malicious : colors.accent}
              checkColor={colors.surface}
            />
          </View>
          <Text style={s.analysingText}>{url ? 'Analysing link' : 'Analysing your file'}</Text>
          <Text style={s.targetName} numberOfLines={1}>{targetName}</Text>
          <Text style={s.sourceText}>
            {source === 'manual' ? 'Link submitted for analysis'
            : source === 'share' ? 'URL received via share'
            : source === 'intent' ? 'File received from another app'
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
            <View style={s.errorActions}>
              <TouchableOpacity style={s.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
                <Text style={s.retryBtnText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
                <Text style={s.backBtnText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Job info */}
        {jobId && !error && (
          <View style={s.infoCard}>
            <View style={s.infoRow}>
              <Text style={s.infoKey}>File</Text>
              <Text style={s.infoVal} numberOfLines={1}>{targetName}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoKey}>Status</Text>
              <Text style={s.infoVal}>{scanResult?.status ?? 'Submitted'}</Text>
            </View>
          </View>
        )}

        {/* Phase steps — simple dots */}
        <View style={s.dots}>
          {phases.map((_, i) => (
            <View
              key={i}
              style={[s.dot, i <= phase && !error && s.dotActive, done && s.dotDone]}
            />
          ))}
        </View>

      </View>

      {/* Bottom bar */}
      <View style={[s.bottomBar, error ? s.bottomBarError : null]}>
        {error ? (
          <Text style={s.bottomBarText}>The file was not opened — you are safe.</Text>
        ) : (
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.bottomBarText}>Keep the app open during scanning · Tap to cancel</Text>
          </TouchableOpacity>
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

  shieldWrap: { alignItems: 'center', marginBottom: 32 },
  shieldCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, elevation: 4,
  },
  analysingText: { fontFamily: fonts.heading, fontSize: 22, fontWeight: '700', color: colors.text.primary, marginBottom: 4 },
  targetName: { fontFamily: fonts.mono, fontSize: 13, color: colors.text.secondary, marginBottom: 4, maxWidth: '90%' },
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
  errorActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  retryBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  retryBtnText: { fontFamily: fonts.heading, fontSize: 14, fontWeight: '600', color: '#fff' },
  backBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  backBtnText: { fontFamily: fonts.body, fontSize: 14, color: colors.text.secondary },

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
