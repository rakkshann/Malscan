import { useEffect, useRef, useState } from 'react'
import { getStatus, StatusResponse } from '../services/api'
import { POLL_INTERVAL_MS } from '../constants/config'

export function useScanPoller(jobId: string | null): StatusResponse | null {
  const [result, setResult] = useState<StatusResponse | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!jobId) return

    const poll = async () => {
      try {
        const data = await getStatus(jobId)
        setResult(data)
        if (data.status === 'Completed' || data.status === 'Failed') {
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      } catch (e) {
        console.warn('[MalScan] poll error:', e)
      }
    }

    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [jobId])

  return result
}
