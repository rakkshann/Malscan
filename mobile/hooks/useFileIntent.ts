import { useEffect, useState } from 'react'

export interface FileIntent {
  uri: string | null
  text: string | null
  mimeType: string | null
}

export function useFileIntent(): FileIntent {
  const [intent, setIntent] = useState<FileIntent>({ uri: null, text: null, mimeType: null })

  useEffect(() => {
    let mounted = true

    const setup = async () => {
      try {
        const mod = await import('react-native-receive-sharing-intent')
        const RSI = mod.default ?? mod

        RSI.getReceivedFiles(
          (files: any[]) => {
            if (!mounted || !files?.length) return
            const f = files[0]
            const uri = f.contentUri || f.filePath || null
            const text = f.webLink || f.text || null
            const mimeType = f.mimeType || null
            if (uri) setIntent({ uri, text: null, mimeType })
            else if (text) setIntent({ uri: null, text, mimeType: null })
          },
          (_error: unknown) => { /* non-fatal native module init noise — intentionally suppressed */ },
          'malscan',
        )
      } catch {
        // Native module unavailable — intent sharing gracefully disabled
      }
    }

    setup()

    return () => {
      mounted = false
      import('react-native-receive-sharing-intent')
        .then(mod => { const RSI = mod.default ?? mod; RSI.clearReceivedFiles?.() })
        .catch(() => {})
    }
  }, [])

  return intent
}
