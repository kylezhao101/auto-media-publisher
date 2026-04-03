import { useEffect, useRef, useState } from "react"
import { getApiKey } from "@/store/apiKeyStore"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
const ACTIVE_STATUSES = ["queued", "rendering", "rendered"]
const RECONNECT_DELAY_MS = 3000

export interface JobProgress {
  rendering_progress?: number
  publishing_progress?: number
}

export function useJobProgress(
  jobId: string | null,
  status: string,
  onStatusChange?: (status: string) => void,
  onProgressUpdate?: (jobId: string, rendering: number, publishing: number, status: string) => void,
){
  const [progress, setProgress] = useState<JobProgress>({ rendering_progress: 0, publishing_progress: 0 })
  
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!jobId || !ACTIVE_STATUSES.includes(status)) return

    function connect() {
      const url = `${API_BASE_URL}/jobs/${jobId}/stream`
      const apiKey = getApiKey()
      const es = new EventSource(`${url}?api_key=${apiKey}`)
      esRef.current = es

      es.onmessage = (e) => {
        const data = JSON.parse(e.data)

        setProgress({
          rendering_progress: data.rendering_progress ?? 0,
          publishing_progress: data.publishing_progress ?? 0,
        })

        onProgressUpdate?.(
          jobId!,
          data.rendering_progress ?? 0,
          data.publishing_progress ?? 0,
          data.status
        )

        if (data.status !== status) {
          onStatusChange?.(data.status)
        }

        if (data.status === "published" || data.status === "failed") {
          es.close()
          onProgressUpdate?.(jobId!, data.rendering_progress ?? 0, data.publishing_progress ?? 0, data.status) // final refresh
        }
      }

      es.onerror = (e) => {
        console.error("SSE error:", e)
        es.close()
        if (!["published", "failed"].includes(status)) {
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS)
        }
      }
    }

    connect()

    return () => {
      esRef.current?.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [jobId, status])

  return progress
}