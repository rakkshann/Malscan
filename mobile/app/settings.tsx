import { useEffect, useState } from 'react'
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTheme } from '../contexts/ThemeContext'
import { loadSettings, saveSettings } from '../services/settings'
import { checkHealth, updateApiBaseUrl } from '../services/api'
import { API_BASE_URL } from '../constants/config'

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

export default function SettingsScreen() {
  const { colors, fonts, isDark, toggleTheme } = useTheme()
  const [apiUrl, setApiUrl] = useState('')
  const [testState, setTestState] = useState<TestState>('idle')
  const s = makeStyles(colors, fonts)

  useEffect(() => { loadSettings().then(s => setApiUrl(s.apiBaseUrl)) }, [])

  const handleSave = async () => {
    const trimmed = apiUrl.trim()
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Alert.alert('Invalid URL', 'Must start with http:// or https://')
      return
    }
    await saveSettings({ apiBaseUrl: trimmed })
    updateApiBaseUrl(trimmed)
    Alert.alert('Saved', 'Backend URL updated.')
  }

  const handleTest = async () => {
    const trimmed = apiUrl.trim()
    updateApiBaseUrl(trimmed)
    setTestState('testing')
    setTestState(await checkHealth() ? 'ok' : 'fail')
  }

  const testLabel =
    testState === 'testing' ? 'Testing...'
    : testState === 'ok'   ? '✓  Connected'
    : testState === 'fail' ? '✕  Unreachable'
    : 'Test Connection'

  const testColor =
    testState === 'ok'   ? colors.verdicts.clear
    : testState === 'fail' ? colors.verdicts.malicious
    : colors.text.secondary

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 70 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content}>

          {/* Appearance */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Appearance</Text>
            <View style={s.card}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>Dark Mode</Text>
                  <Text style={s.rowSub}>Switch between dark and light theme</Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </View>

          {/* Backend */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Scan Engine</Text>
            <Text style={s.hint}>
              The IP address of your PC running the backend.{'\n'}
              Open PowerShell → `ipconfig` → IPv4 Address. Port is 8000.
            </Text>
            <View style={s.card}>
              <TextInput
                style={s.input}
                value={apiUrl}
                onChangeText={v => { setApiUrl(v); setTestState('idle') }}
                placeholder="http://192.168.x.x:8000"
                placeholderTextColor={colors.text.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <View style={s.btnRow}>
                <TouchableOpacity
                  style={[s.testBtn, { borderColor: testState === 'ok' ? colors.verdicts.clearBorder : testState === 'fail' ? colors.verdicts.maliciousBorder : colors.border }]}
                  onPress={handleTest}
                  disabled={testState === 'testing'}
                >
                  <Text style={[s.testBtnText, { color: testColor }]}>{testLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.resetBtn} onPress={() => { setApiUrl(API_BASE_URL); setTestState('idle') }}>
                  <Text style={s.resetBtnText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* About */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>About</Text>
            <View style={s.card}>
              {[
                { k: 'App',          v: 'MalScan' },
                { k: 'Version',      v: '1.1.0' },
                { k: 'Threat intel', v: 'VirusTotal · URLScan · abuse.ch' },
                { k: 'Platform',     v: 'Android' },
              ].map(({ k, v }) => (
                <View key={k} style={s.aboutRow}>
                  <Text style={s.aboutKey}>{k}</Text>
                  <Text style={s.aboutVal}>{v}</Text>
                </View>
              ))}
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any, fonts: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  backBtnText: { fontFamily: fonts.body, fontSize: 13, color: colors.text.secondary },
  title: { fontFamily: fonts.heading, fontSize: 17, fontWeight: '700', color: colors.text.primary },

  content: { padding: 20, gap: 24 },
  section: { gap: 10 },
  sectionLabel: { fontFamily: fonts.heading, fontSize: 12, fontWeight: '600', color: colors.accent, letterSpacing: 0.5, textTransform: 'uppercase' },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.text.muted, lineHeight: 18 },

  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  rowTitle: { fontFamily: fonts.body, fontSize: 15, color: colors.text.primary, marginBottom: 2 },
  rowSub: { fontFamily: fonts.body, fontSize: 12, color: colors.text.muted },

  input: { fontFamily: fonts.mono, fontSize: 13, color: colors.text.primary, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  btnRow: { flexDirection: 'row', gap: 0 },
  testBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, borderRightWidth: 1 },
  testBtnText: { fontFamily: fonts.body, fontSize: 13 },
  resetBtn: { paddingVertical: 13, paddingHorizontal: 20, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  resetBtnText: { fontFamily: fonts.body, fontSize: 13, color: colors.text.muted },

  saveBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', elevation: 2 },
  saveBtnText: { fontFamily: fonts.heading, fontSize: 15, fontWeight: '600', color: '#fff' },

  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderFaint },
  aboutKey: { fontFamily: fonts.body, fontSize: 13, color: colors.text.muted },
  aboutVal: { fontFamily: fonts.body, fontSize: 13, color: colors.text.primary },
})
