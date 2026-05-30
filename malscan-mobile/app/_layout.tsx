import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { COLORS } from '../constants/theme'
import { loadSettings } from '../services/settings'
import { updateApiBaseUrl } from '../services/api'

export default function RootLayout() {
  // Load persisted backend URL before first render of any screen
  useEffect(() => {
    loadSettings().then(s => updateApiBaseUrl(s.apiBaseUrl))
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar style="light" backgroundColor={COLORS.background} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'fade',
        }}
      />
    </GestureHandlerRootView>
  )
}
