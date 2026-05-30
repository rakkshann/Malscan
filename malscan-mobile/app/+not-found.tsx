import { useEffect } from 'react'
import { View } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { COLORS } from '../constants/theme'

export default function NotFound() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || pathname === '/') return
    // When Android opens a file with MalScan (ACTION_VIEW), the content:// URI
    // arrives as malscan:///provider/path. Expo-router can't match the path so
    // it lands here. Reconstruct content:// and send straight to scanning.
    const contentUri = 'content:/' + pathname
    router.replace({
      pathname: '/scanning',
      params: {
        uri: contentUri,
        filename: pathname.split('/').pop() || 'file',
        source: 'intent',
      },
    })
  }, [])

  return <View style={{ flex: 1, backgroundColor: COLORS.background }} />
}
