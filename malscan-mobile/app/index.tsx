import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
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
import { useTheme } from '../contexts/ThemeContext'
import { checkHealth } from '../services/api'

type ConnStatus = 'checking' | 'online' | 'offline'

const HOW_TO_STEPS = [
  { num: '1', text: 'Receive a file on WhatsApp' },
  { num: '2', text: 'Long-press the file → Share → Open with MalScan' },
  { num: '3', text: 'MalScan scans it safely before you open it' },
]

export default function HomeScreen() {
  const { colors, fonts } = useTheme()
  const { uri: intentUri, text: intentText, mimeType: intentMimeType } = useFileIntent()
  const [urlInput, setUrlInput] = useState('')
  const [isPicking, setIsPicking] = useState(false)
  const [connStatus, setConnStatus] = useState<ConnStatus>('checking')

  const s = makeStyles(colors, fonts)

  // Pulse animation on shield
  const pulse = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1800, useNativeDriver: true }),
      ]),
    ).start()
  }, [])

  // Real backend health check
  const runHealthCheck = useCallback(async () => {
    setConnStatus('checking')
    setConnStatus(await checkHealth() ? 'online' : 'offline')
  }, [])

  useFocusEffect(useCallback(() => { runHealthCheck() }, [runHealthCheck]))

  // Intent intercept
  useEffect(() => {
    if (!intentUri) return
    const name = intentUri.split('/').pop() || 'scan_target'
    router.push({ pathname: '/scanning', params: { uri: intentUri, filename: name, source: 'intent', mimeType: intentMimeType || '' } })
  }, [intentUri])

  useEffect(() => {
    if (!intentText) return
    router.push({ pathname: '/scanning', params: { url: intentText, source: 'share' } })
  }, [intentText])

  const handlePickFile = async () => {
    try {
      setIsPicking(true)
      const result = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: true, multiple: false })
      if (!result.canceled && result.assets[0]) {
        const { uri, name, mimeType } = result.assets[0]
        router.push({ pathname: '/scanning', params: { uri, filename: name, source: 'picker', mimeType: mimeType || '' } })
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

  const dotColor =
    connStatus === 'online'  ? colors.verdicts.clear
    : connStatus === 'offline' ? colors.verdicts.malicious
    : colors.verdicts.suspicious

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Top bar ────────────────────────────────────────────────────── */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.topBtn} onPress={() => router.push('/history')}>
            <Text style={s.topBtnText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.topBtn} onPress={() => router.push('/settings')}>
            <Text style={s.topBtnText}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <View style={s.hero}>
          <Animated.View style={[s.iconCircle, { transform: [{ scale: pulse }] }]}>
            <Text style={s.iconGlyph}>🛡</Text>
          </Animated.View>
          <Text style={s.appName}>MalScan</Text>
          <Text style={s.tagline}>Scan before you open</Text>
        </View>

        {/* ── How it works ───────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>How to scan a WhatsApp file</Text>
          {HOW_TO_STEPS.map(step => (
            <View key={step.num} style={s.step}>
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{step.num}</Text>
              </View>
              <Text style={s.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Pick from device ───────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Or pick a file from your device</Text>
          <TouchableOpacity
            style={[s.primaryBtn, isPicking && s.primaryBtnDisabled]}
            onPress={handlePickFile}
            activeOpacity={0.8}
            disabled={isPicking}
          >
            {isPicking
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.primaryBtnText}>Select File</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── Scan a URL ─────────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Scan a link</Text>
          <View style={s.urlRow}>
            <TextInput
              style={s.urlInput}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="https://suspicious-link.com"
              placeholderTextColor={colors.text.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleScanUrl}
            />
            <TouchableOpacity style={s.urlBtn} onPress={handleScanUrl} activeOpacity={0.8}>
              <Text style={s.urlBtnText}>Scan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Status footer ──────────────────────────────────────────────── */}
        <TouchableOpacity style={s.statusRow} onPress={runHealthCheck} activeOpacity={0.7}>
          {connStatus === 'checking'
            ? <ActivityIndicator color={dotColor} size={10} />
            : <View style={[s.statusDot, { backgroundColor: dotColor }]} />
          }
          <Text style={[s.statusText, { color: dotColor }]}>
            {connStatus === 'online'  ? 'Connected to scan engine'
            : connStatus === 'offline' ? 'Engine offline — tap to retry'
            : 'Connecting...'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any, fonts: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  topBar: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginBottom: 24 },
  topBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topBtnText: { fontFamily: fonts.body, fontSize: 13, color: colors.text.secondary },

  hero: { alignItems: 'center', marginBottom: 32 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 4,
  },
  iconGlyph: { fontSize: 42 },
  appName: {
    fontFamily: fonts.heading,
    fontSize: 34,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text.muted,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 16,
  },

  step: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: { fontFamily: fonts.heading, fontSize: 13, fontWeight: '700', color: '#fff' },
  stepText: { fontFamily: fonts.body, fontSize: 14, color: colors.text.secondary, flex: 1, lineHeight: 20 },

  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontFamily: fonts.heading, fontSize: 15, fontWeight: '600', color: '#fff' },

  urlRow: { flexDirection: 'row', gap: 10 },
  urlInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text.primary,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  urlBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  urlBtnText: { fontFamily: fonts.heading, fontSize: 14, fontWeight: '600', color: '#fff' },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: fonts.body, fontSize: 12 },
})
