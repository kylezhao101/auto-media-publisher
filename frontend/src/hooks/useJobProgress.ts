import { useEffect, useState } from "react"
import { getApiKey } from "@/store/apiKeyStore"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
const ACTIVE_STATUSES = ["queued", "rendering", "rendered"]

export function useJobProgress(
  jobId: string | null,
  status: string,
  onStatusChange?: (status: string) => void
) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!jobId || !ACTIVE_STATUSES.includes(status)) return

    const url = `${API_BASE_URL}/jobs/${jobId}/stream`
    const apiKey = getApiKey()
    const es = new EventSource(`${url}?api_key=${apiKey}`)

    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setProgress(data.progress ?? 0)
      if (data.status !== status) {
        onStatusChange?.(data.status)
      }
      if (data.status === "published" || data.status === "failed") {
        es.close()
      }
    }

    es.onerror = () => es.close()
    return () => es.close()
  }, [jobId, status])

  return progress
}