import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ThemeProvider, useTheme } from '../contexts/ThemeContext'
import { loadSettings } from '../services/settings'
import { updateApiBaseUrl } from '../services/api'

function AppNavigator() {
  const { colors, isDark } = useTheme()
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      />
    </GestureHandlerRootView>
  )
}

export default function RootLayout() {
  useEffect(() => {
    loadSettings().then(s => updateApiBaseUrl(s.apiBaseUrl))
  }, [])

  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  )
}
