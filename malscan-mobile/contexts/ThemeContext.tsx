import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { darkColors, lightColors, FONTS, AppColors } from '../constants/theme'
import { loadSettings, saveSettings } from '../services/settings'

interface ThemeContextValue {
  colors: AppColors
  fonts: typeof FONTS
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  fonts: FONTS,
  isDark: true,
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    loadSettings().then(s => {
      if (typeof s.isDarkMode === 'boolean') setIsDark(s.isDarkMode)
    })
  }, [])

  const toggleTheme = async () => {
    const next = !isDark
    setIsDark(next)
    await saveSettings({ isDarkMode: next })
  }

  const value = useMemo<ThemeContextValue>(() => ({
    colors: isDark ? darkColors : lightColors,
    fonts: FONTS,
    isDark,
    toggleTheme,
  }), [isDark])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
