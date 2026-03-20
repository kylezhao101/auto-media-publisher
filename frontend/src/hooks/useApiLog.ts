import { useEffect, useState } from "react"
import { getApiLogs, subscribeApiLogs, clearApiLogs } from "@/lib/apiLogStore"
import type { ApiLogEntry } from "@/types/log"

export function useApiLogs() {
  const [logs, setLogs] = useState<ApiLogEntry[]>(getApiLogs())

  useEffect(() => {
    const unsubscribe = subscribeApiLogs(setLogs)
    return () => {
      unsubscribe()
    }
  }, [])

  return {
    logs,
    clearLogs: clearApiLogs,
  }
}