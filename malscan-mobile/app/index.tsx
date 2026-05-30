import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { useFileIntent } from '../hooks/useFileIntent'
import { COLORS, FONT } from '../constants/theme'
import { checkHealth } from '../services/api'

type ConnStatus = 'checking' | 'online' | 'offline'

export default function HomeScreen() {
  const { uri: intentUri, text: intentText } = useFileIntent()
  const [urlInput, setUrlInput] = useState('')
  const [isPicking, setIsPicking] = useState(false)
  const [connStatus, setConnStatus] = useState<ConnStatus>('checking')

  // ── Animations ──────────────────────────────────────────────────────────────
  const pulse = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    ).start()
  }, [])

  const blink = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start()
  }, [])

  // ── Real backend health check (re-runs every time screen is focused) ─────────
  const runHealthCheck = useCallback(async () => {
    setConnStatus('checking')
    const alive = await checkHealth()
    setConnStatus(alive ? 'online' : 'offline')
  }, [])

  useFocusEffect(useCallback(() => { runHealthCheck() }, [runHealthCheck]))

  // ── Intent intercept ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!intentUri) return
    const name = intentUri.split('/').pop() || 'scan_target'
    router.push({ pathname: '/scanning', params: { uri: intentUri, filename: name, source: 'intent' } })
  }, [intentUri])

  useEffect(() => {
    if (!intentText) return
    router.push({ pathname: '/scanning', params: { url: intentText, source: 'share' } })
  }, [intentText])

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handlePickFile = async () => {
    try {
      setIsPicking(true)
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      })
      if (!result.canceled && result.assets[0]) {
        const { uri, name } = result.assets[0]
        router.push({ pathname: '/scanning', params: { uri, filename: name, source: 'picker' } })
      }
    } catch {
      Alert.alert('Error', 'Could not open file picker.')
    } finally {
      setIsPicking(false)
    }
  }

  const handleScanUrl = () => {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Alert.alert('Invalid URL', 'Please enter a URL starting with http:// or https://')
      return
    }
    setUrlInput('')
    router.push({ pathname: '/scanning', params: { url: trimmed, source: 'manual' } })
  }

  // ── Derived status display ───────────────────────────────────────────────────
  const dotColor =
    connStatus === 'online' ? COLORS.verdicts.clear
    : connStatus === 'offline' ? COLORS.verdicts.malicious
    : COLORS.verdicts.suspicious

  const statusLabel =
    connStatus === 'online' ? 'BACKEND CONNECTED'
    : connStatus === 'offline' ? 'BACKEND OFFLINE — TAP TO RETRY'
    : 'CONNECTING...'

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── Top nav ─────────────────────────────────────────────────────── */}
        <View style={styles.nav}>
          <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/history')}>
            <Text style={styles.navBtnText}>HISTORY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/settings')}>
            <Text style={styles.navBtnText}>⚙  CONFIG</Text>
          </TouchableOpacity>
        </View>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MOBILE SECURITY SCANNER</Text>
          <Animated.Text style={[styles.logoGlyph, { transform: [{ scale: pulse }] }]}>
            ⬡
          </Animated.Text>
          <Text style={styles.logoText}>MALSCAN</Text>
          <Text style={styles.tagline}>Intercept. Analyze. Protect.</Text>
        </View>

        {/* ── File upload card ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>SCAN A FILE</Text>
          <TouchableOpacity
            style={[styles.dropzone, isPicking && styles.dropzoneDisabled]}
            onPress={handlePickFile}
            activeOpacity={0.75}
            disabled={isPicking}
          >
            {isPicking ? (
              <ActivityIndicator color={COLORS.accent} />
            ) : (
              <>
                <Text style={styles.dropzoneArrow}>↑</Text>
                <Text style={styles.dropzoneMain}>TAP TO SELECT FILE</Text>
                <Text style={styles.dropzoneHint}>PDF · APK · ZIP · EXE · Any file</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.airlockNote}>
            Or share any file to MalScan from another app — the airlock intercepts automatically.
          </Text>
        </View>

        {/* ── URL scan card ──────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>SCAN A URL</Text>
          <View style={styles.urlRow}>
            <TextInput
              style={styles.urlInput}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="https://suspicious-link.com"
              placeholderTextColor={COLORS.text.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleScanUrl}
            />
            <TouchableOpacity style={styles.scanBtn} onPress={handleScanUrl} activeOpacity={0.85}>
              <Text style={styles.scanBtnText}>SCAN</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Footer status ──────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.footer}
          onPress={runHealthCheck}
          activeOpacity={0.7}
        >
          {connStatus === 'checking' ? (
            <ActivityIndicator color={COLORS.verdicts.suspicious} size={10} style={styles.statusDot} />
          ) : (
            <Animated.View style={[styles.statusDot, { opacity: blink, backgroundColor: dotColor }]} />
          )}
          <Text style={[styles.statusText, { color: dotColor }]}>
            AIRLOCK ACTIVE · {statusLabel}
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },

  // Nav
  nav: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginBottom: 20,
  },
  navBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  navBtnText: {
    fontFamily: FONT.mono,
    fontSize: 9,
    color: COLORS.text.secondary,
    letterSpacing: 2,
  },

  // Header
  header: { alignItems: 'center', marginBottom: 28 },
  eyebrow: {
    fontFamily: FONT.mono,
    fontSize: 9,
    color: COLORS.accent,
    letterSpacing: 4,
    marginBottom: 14,
  },
  logoGlyph: {
    fontSize: 50,
    color: COLORS.accent,
    marginBottom: 6,
    lineHeight: 56,
  },
  logoText: {
    fontFamily: FONT.mono,
    fontSize: 30,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    letterSpacing: 14,
    marginBottom: 6,
  },
  tagline: {
    fontFamily: FONT.mono,
    fontSize: 11,
    color: COLORS.text.secondary,
    letterSpacing: 2,
  },

  // Cards
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 18,
    marginBottom: 14,
  },
  cardLabel: {
    fontFamily: FONT.mono,
    fontSize: 9,
    color: COLORS.text.secondary,
    letterSpacing: 3,
    marginBottom: 12,
  },

  // Dropzone
  dropzone: {
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    borderStyle: 'dashed',
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentDim,
    minHeight: 96,
  },
  dropzoneDisabled: { opacity: 0.5 },
  dropzoneArrow: { fontSize: 24, color: COLORS.accent, marginBottom: 8, lineHeight: 28 },
  dropzoneMain: {
    fontFamily: FONT.mono,
    fontSize: 12,
    color: COLORS.text.primary,
    letterSpacing: 3,
    marginBottom: 5,
  },
  dropzoneHint: {
    fontFamily: FONT.mono,
    fontSize: 9,
    color: COLORS.text.muted,
    letterSpacing: 1,
  },
  airlockNote: {
    fontFamily: FONT.mono,
    fontSize: 9,
    color: COLORS.text.muted,
    lineHeight: 14,
    marginTop: 10,
    letterSpacing: 0.3,
  },

  // URL row
  urlRow: { flexDirection: 'row', gap: 10 },
  urlInput: {
    flex: 1,
    fontFamily: FONT.mono,
    fontSize: 12,
    color: COLORS.text.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  scanBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  scanBtnText: {
    fontFamily: FONT.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },

  // Footer
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontFamily: FONT.mono,
    fontSize: 9,
    letterSpacing: 2,
  },
})
