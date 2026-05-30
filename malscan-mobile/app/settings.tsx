import { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { COLORS, FONT } from '../constants/theme'
import { loadSettings, saveSettings } from '../services/settings'
import { checkHealth, updateApiBaseUrl } from '../services/api'
import { API_BASE_URL } from '../constants/config'

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

export default function SettingsScreen() {
  const [apiUrl, setApiUrl] = useState('')
  const [testState, setTestState] = useState<TestState>('idle')

  useEffect(() => {
    loadSettings().then(s => setApiUrl(s.apiBaseUrl))
  }, [])

  const handleSave = async () => {
    const trimmed = apiUrl.trim()
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Alert.alert('Invalid URL', 'Backend URL must start with http:// or https://')
      return
    }
    await saveSettings({ apiBaseUrl: trimmed })
    updateApiBaseUrl(trimmed)
    Alert.alert('Saved', 'Backend URL updated successfully.')
  }

  const handleTest = async () => {
    const trimmed = apiUrl.trim()
    updateApiBaseUrl(trimmed)
    setTestState('testing')
    const alive = await checkHealth()
    setTestState(alive ? 'ok' : 'fail')
  }

  const handleReset = () => {
    setApiUrl(API_BASE_URL)
    setTestState('idle')
  }

  const testLabel =
    testState === 'testing' ? 'TESTING...'
    : testState === 'ok'    ? '✓  REACHABLE'
    : testState === 'fail'  ? '✕  UNREACHABLE'
    : 'TEST CONNECTION'

  const testColor =
    testState === 'ok'   ? COLORS.verdicts.clear
    : testState === 'fail' ? COLORS.verdicts.malicious
    : COLORS.text.secondary

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>CONFIGURATION</Text>
        <View style={{ width: 70 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>

          {/* Backend URL */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>BACKEND URL</Text>
            <Text style={styles.hint}>
              IP address of the machine running the FastAPI backend.{'\n'}
              Windows: open PowerShell → `ipconfig` → IPv4 Address.{'\n'}
              Port is always 8000.
            </Text>
            <TextInput
              style={styles.input}
              value={apiUrl}
              onChangeText={v => { setApiUrl(v); setTestState('idle') }}
              placeholder="http://192.168.x.x:8000"
              placeholderTextColor={COLORS.text.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.testBtn} onPress={handleTest} disabled={testState === 'testing'}>
                <Text style={[styles.testBtnText, { color: testColor }]}>{testLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <Text style={styles.resetBtnText}>RESET</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>SAVE</Text>
            </TouchableOpacity>
          </View>

          {/* About */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ABOUT</Text>
            <View style={styles.aboutCard}>
              {[
                { k: 'APP',      v: 'MalScan Mobile' },
                { k: 'VERSION',  v: '1.0.0' },
                { k: 'ENGINE',   v: 'MalScan Pro V.2.4' },
                { k: 'PLATFORM', v: 'Android / Expo SDK 51' },
                { k: 'RN',       v: '0.74.5' },
              ].map(({ k, v }) => (
                <View key={k} style={styles.aboutRow}>
                  <Text style={styles.aboutKey}>{k}</Text>
                  <Text style={styles.aboutVal}>{v}</Text>
                </View>
              ))}
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 6 },
  backBtnText: { fontFamily: FONT.mono, fontSize: 10, color: COLORS.text.secondary, letterSpacing: 2 },
  title: { fontFamily: FONT.mono, fontSize: 12, fontWeight: 'bold', color: COLORS.text.primary, letterSpacing: 4 },

  content: { padding: 20, gap: 28 },

  section: { gap: 12 },
  sectionLabel: { fontFamily: FONT.mono, fontSize: 9, color: COLORS.accent, letterSpacing: 3 },
  hint: {
    fontFamily: FONT.mono,
    fontSize: 10,
    color: COLORS.text.muted,
    lineHeight: 17,
    letterSpacing: 0.3,
  },
  input: {
    fontFamily: FONT.mono,
    fontSize: 13,
    color: COLORS.text.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: { flexDirection: 'row', gap: 10 },
  testBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  testBtnText: { fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2 },
  resetBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetBtnText: { fontFamily: FONT.mono, fontSize: 10, color: COLORS.text.muted, letterSpacing: 2 },
  saveBtn: { backgroundColor: COLORS.accent, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontFamily: FONT.mono, fontSize: 11, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: 3 },

  aboutCard: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderFaint,
  },
  aboutKey: { fontFamily: FONT.mono, fontSize: 9, color: COLORS.text.muted, letterSpacing: 2, width: 80 },
  aboutVal: { fontFamily: FONT.mono, fontSize: 10, color: COLORS.text.primary, flex: 1, textAlign: 'right' },
})
