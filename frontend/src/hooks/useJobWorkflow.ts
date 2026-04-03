import { useCallback, useEffect, useState } from "react"
import { getAllJobs } from "../lib/api"
import type { JobStatusResponse } from "../types/job"
import { useJobEditor } from "./useJobEditor"
import { useJobRunner } from "./useJobRunner"

export function useJobWorkflow() {
  const editor = useJobEditor()
  const [allJobs, setAllJobs] = useState<JobStatusResponse[]>([])

  const handleGetAllJobs = useCallback(async () => {
    try {
      const jobs = await getAllJobs()
      setAllJobs(jobs)
    } catch (err) {
      console.error("Failed to fetch all jobs:", err instanceof Error ? err.message : err)
    }
  }, [])

  const handleJobProgress = useCallback(
    (id: string, rendering: number, publishing: number, newStatus: string) => {
      setAllJobs((prev) =>
        prev.map((j) =>
          j.job_id !== id
            ? j
            : {
                ...j,
                status: newStatus,
                progress: {
                  rendering_progress: rendering,
                  publishing_progress: publishing,
                },
              }
        )
      )
    },
    []
  )

  const runner = useJobRunner({
    editor,
    refreshAllJobs: handleGetAllJobs,
    onJobProgress: handleJobProgress,
  })

  useEffect(() => {
    handleGetAllJobs()
  }, [handleGetAllJobs])

  return {
    ...editor,
    ...runner,
    allJobs,
    handleGetAllJobs,
  }
}