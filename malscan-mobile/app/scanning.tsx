import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { uploadFile, submitUrl } from '../services/api'
import { useScanPoller } from '../hooks/useScanPoller'
import { addToHistory } from '../services/history'
import { COLORS, FONT } from '../constants/theme'

const PHASES = [
  'INITIALIZING AIRLOCK...',
  'COMPUTING SHA-256 HASH...',
  'EXTRACTING STRINGS & IOCs...',
  'ANALYZING PE HEADERS...',
  'CHECKING KNOWN-HASH BLOCKLIST...',
  'QUERYING VIRUSTOTAL API...',
  'RUNNING URLSCAN SANDBOX...',
  'PERFORMING WHOIS LOOKUP...',
  'RESOLVING DNS RECORDS...',
  'GEOLOCATING INFRASTRUCTURE...',
  'RUNNING ATTRIBUTION ENGINE...',
  'CALCULATING THREAT SCORE...',
  'CLUSTERING INFRASTRUCTURE...',
  'GENERATING FORENSIC REPORT...',
] as const

export default function ScanningScreen() {
  const { uri, url, filename, source } = useLocalSearchParams<{
    uri?: string
    url?: string
    filename?: string
    source?: string
  }>()

  const [jobId, setJobId] = useState<string | null>(null)
  const [phase, setPhase] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const phaseTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Scan line sweep — pointerEvents must be in style, NOT a prop (RN 0.74+ deprecation)
  const scanY = useRef(new Animated.Value(-2)).current
  useEffect(() => {
    Animated.loop(
      Animated.timing(scanY, { toValue: 1000, duration: 2400, useNativeDriver: true }),
    ).start()
  }, [])

  // Shield pulse
  const shield = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shield, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(shield, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start()
  }, [])

  // Phase cycling + elapsed timer
  useEffect(() => {
    phaseTimer.current = setInterval(
      () => setPhase(p => Math.min(p + 1, PHASES.length - 1)),
      2200,
    )
    elapsedTimer.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => {
      if (phaseTimer.current) clearInterval(phaseTimer.current)
      if (elapsedTimer.current) clearInterval(elapsedTimer.current)
    }
  }, [])

  // Upload on mount
  useEffect(() => {
    const start = async () => {
      try {
        let id: string
        if (uri) {
          id = await uploadFile(uri, filename || 'scan_target')
        } else if (url) {
          id = await submitUrl(url)
        } else {
          setError('No file or URL was provided to scan.')
          return
        }
        setJobId(id)
      } catch (e: any) {
        const msg = e?.response?.data?.detail || e?.message || 'Upload failed.'
        setError(`${msg}\n\nIs the backend running? Check Settings → CONFIG.`)
      }
    }
    start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for result
  const scanResult = useScanPoller(jobId)
  useEffect(() => {
    if (!scanResult) return

    if (scanResult.status === 'Completed' && !done) {
      setDone(true)
      if (phaseTimer.current) clearInterval(phaseTimer.current)
      if (elapsedTimer.current) clearInterval(elapsedTimer.current)

      // Persist to local scan history
      const r = scanResult.results
      if (r) {
        addToHistory({
          jobId: scanResult.job_id,
          target: filename || url || uri || 'Unknown',
          verdict: r.verdict,
          score: r.score,
          family: r.family || 'Unknown',
          scannedAt: new Date().toISOString(),
        })
      }

      setTimeout(() => {
        router.replace({
          pathname: '/verdict',
          params: { jobId: scanResult.job_id, originalUri: uri || '' },
        })
      }, 700)
    }

    if (scanResult.status === 'Failed') {
      setError('The backend analysis pipeline encountered an error. Check server logs.')
    }
  }, [scanResult]) // eslint-disable-line react-hooks/exhaustive-deps

  const progress = Math.min(((phase + 1) / PHASES.length) * 100, done ? 100 : 95)

  return (
    <SafeAreaView style={styles.safe}>
      {/* Scan line — pointerEvents in style to avoid RN 0.74 deprecation warning */}
      <Animated.View
        style={[
          styles.scanLine,
          { transform: [{ translateY: scanY }], pointerEvents: 'none' },
        ]}
      />

      <View style={styles.container}>
        {/* ── Top bar ────────────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <Text style={styles.topLabel}>AIRLOCK ENGAGED</Text>
          <View style={[styles.pill, error ? styles.pillError : styles.pillActive]}>
            <Text style={styles.pillText}>
              {error ? 'ERROR' : done ? 'COMPLETE' : 'SCANNING'}
            </Text>
          </View>
        </View>

        {/* ── Shield ──────────────────────────────────────────────────────── */}
        <View style={styles.center}>
          <Animated.Text style={[styles.shieldGlyph, { transform: [{ scale: shield }] }]}>
            ⬡
          </Animated.Text>
          <Text style={styles.title}>ANALYZING</Text>
          <Text style={styles.sub}>
            {source === 'intent'  ? 'File intercepted from external app'
            : source === 'share' ? 'URL received via share target'
            : source === 'picker'? 'File selected from device storage'
            :                      'Manual scan initiated'}
          </Text>
        </View>

        {/* ── Current phase ───────────────────────────────────────────────── */}
        <View style={styles.phaseBox}>
          <Text style={styles.phaseLabel}>CURRENT OPERATION</Text>
          <Text style={styles.phaseText} numberOfLines={1}>
            {error ? '⚠  ERROR DETECTED' : PHASES[phase]}
          </Text>
        </View>

        {/* ── Progress bar ────────────────────────────────────────────────── */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress)}%` as `${number}%` }]} />
        </View>
        <View style={styles.progressMeta}>
          <Text style={styles.metaText}>{Math.round(progress)}% COMPLETE</Text>
          <Text style={styles.metaText}>{elapsed}s ELAPSED</Text>
        </View>

        {/* ── Job metadata ─────────────────────────────────────────────────── */}
        <View style={styles.metaBox}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : jobId ? (
            <>
              <Text style={styles.metaRow}>
                <Text style={styles.metaKey}>JOB_ID  </Text>
                {jobId.slice(0, 8).toUpperCase()}...
              </Text>
              <Text style={styles.metaRow}>
                <Text style={styles.metaKey}>STATUS  </Text>
                {scanResult?.status ?? 'Submitted'}
              </Text>
              <Text style={styles.metaRow}>
                <Text style={styles.metaKey}>TARGET  </Text>
                {(filename || url || uri || '').slice(0, 40)}
              </Text>
            </>
          ) : (
            <Text style={styles.metaRow}>UPLOADING ARTIFACT TO BACKEND...</Text>
          )}
        </View>

        {/* ── Live log stream ──────────────────────────────────────────────── */}
        <View style={styles.logBox}>
          {[...PHASES]
            .slice(0, phase + 1)
            .reverse()
            .slice(0, 4)
            .map((p, i) => (
              <Text key={p} style={[styles.logLine, i === 0 && !error && styles.logLineActive]}>
                {'>'} {p}
              </Text>
            ))}
        </View>
      </View>

      {/* ── Warning bar ──────────────────────────────────────────────────────── */}
      <View style={styles.warningBar}>
        <Text style={styles.warningText}>DO NOT CLOSE · ANALYSIS IN PROGRESS</Text>
      </View>

      {/* Error back button */}
      {error && (
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← GO BACK</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.accent,
    opacity: 0.12,
    zIndex: 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    zIndex: 1,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  topLabel: {
    fontFamily: FONT.mono,
    fontSize: 9,
    color: COLORS.accent,
    letterSpacing: 4,
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  pillActive: {
    borderColor: COLORS.verdicts.suspiciousBorder,
    backgroundColor: COLORS.verdicts.suspiciousDim,
  },
  pillError: {
    borderColor: COLORS.verdicts.maliciousBorder,
    backgroundColor: COLORS.verdicts.maliciousDim,
  },
  pillText: {
    fontFamily: FONT.mono,
    fontSize: 8,
    color: COLORS.text.primary,
    letterSpacing: 2,
  },

  center: { alignItems: 'center', marginBottom: 28 },
  shieldGlyph: { fontSize: 44, color: COLORS.accent, lineHeight: 50, marginBottom: 8 },
  title: {
    fontFamily: FONT.mono,
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    letterSpacing: 8,
    marginBottom: 4,
  },
  sub: { fontFamily: FONT.mono, fontSize: 9, color: COLORS.text.muted, letterSpacing: 1 },

  phaseBox: {
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentDim,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  phaseLabel: {
    fontFamily: FONT.mono,
    fontSize: 8,
    color: COLORS.accent,
    letterSpacing: 3,
    marginBottom: 5,
  },
  phaseText: {
    fontFamily: FONT.mono,
    fontSize: 12,
    color: COLORS.text.primary,
    letterSpacing: 0.5,
  },

  progressTrack: {
    height: 2,
    backgroundColor: COLORS.border,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.accent },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metaText: { fontFamily: FONT.mono, fontSize: 9, color: COLORS.text.muted, letterSpacing: 1 },

  metaBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 14,
    marginBottom: 16,
    gap: 6,
  },
  metaRow: { fontFamily: FONT.mono, fontSize: 10, color: COLORS.text.secondary, letterSpacing: 0.5 },
  metaKey: { color: COLORS.text.muted, letterSpacing: 1 },
  errorText: {
    fontFamily: FONT.mono,
    fontSize: 10,
    color: COLORS.verdicts.malicious,
    lineHeight: 16,
  },

  logBox: { gap: 5 },
  logLine: { fontFamily: FONT.mono, fontSize: 10, color: COLORS.text.muted, letterSpacing: 0.3 },
  logLineActive: { color: COLORS.accent },

  warningBar: {
    borderTopWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentDim,
    paddingVertical: 10,
    alignItems: 'center',
  },
  warningText: { fontFamily: FONT.mono, fontSize: 9, color: COLORS.accent, letterSpacing: 3 },

  backBtn: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backBtnText: { fontFamily: FONT.mono, fontSize: 11, color: COLORS.text.secondary, letterSpacing: 2 },
})
