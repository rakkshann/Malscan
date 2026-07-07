import { useEffect } from 'react'
import { View } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { COLORS } from '../constants/theme'

export default function NotFound() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || pathname === '/') return

    const contentUri = 'content:/' + pathname
    const segments = pathname.split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1] || 'shared_file'
    const filename = decodeURIComponent(lastSegment)

    // Defer navigation — the Root Layout may not have mounted yet when an
    // Android intent triggers this screen directly on cold start.
    const timer = setTimeout(() => {
      router.replace({
        pathname: '/scanning',
        params: { uri: contentUri, filename, source: 'intent' },
      })
    }, 150)

    return () => clearTimeout(timer)
  }, [])

  return <View style={{ flex: 1, backgroundColor: COLORS.background }} />
}
