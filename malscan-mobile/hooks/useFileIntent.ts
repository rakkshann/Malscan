import { useEffect, useState } from 'react'

export interface FileIntent {
  uri: string | null
  text: string | null
}

/**
 * Intercepts files/URLs shared to the app via Android intents.
 * Wrapped in dynamic import + try/catch so a native-module load failure
 * degrades gracefully instead of crashing the whole app.
 */
export function useFileIntent(): FileIntent {
  const [intent, setIntent] = useState<FileIntent>({ uri: null, text: null })

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
            if (uri) setIntent({ uri, text: null })
            else if (text) setIntent({ uri: null, text })
          },
          (error: unknown) => console.warn('[MalScan] ReceiveSharingIntent error:', error),
          'malscan',
        )
      } catch (e) {
        console.warn('[MalScan] ReceiveSharingIntent not available — intent sharing disabled:', e)
      }
    }

    setup()

    return () => {
      mounted = false
      import('react-native-receive-sharing-intent')
        .then(mod => {
          const RSI = mod.default ?? mod
          RSI.clearReceivedFiles?.()
        })
        .catch(() => {})
    }
  }, [])

  return intent
}
