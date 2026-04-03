import { useCallback, useEffect, useRef, useState } from "react"
import { addAssets, createJob, getJob, submitJob } from "../lib/api"
import { uploadFile } from "../lib/uploadFile"
import type { JobStatusResponse, UploadAsset } from "../types/job"
import { useJobProgress } from "./useJobProgress"
import type { useJobEditor } from "./useJobEditor"

type JobEditor = ReturnType<typeof useJobEditor>

type UseJobRunnerArgs = {
  editor: JobEditor
  refreshAllJobs?: () => Promise<void>
  onJobProgress?: (
    id: string,
    rendering: number,
    publishing: number,
    status: string
  ) => void
}

export function useJobRunner({
  editor,
  refreshAllJobs,
  onJobProgress,
}: UseJobRunnerArgs) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState("not-created")
  const [serverJob, setServerJob] = useState<JobStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [isUploadingAssets, setIsUploadingAssets] = useState(false)
  const [isSubmittingJob, setIsSubmittingJob] = useState(false)
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false)

  const [autoSubmitAfterUpload, setAutoSubmitAfterUpload] = useState(false)

  const jobIdRef = useRef<string | null>(null)

  useEffect(() => {
    jobIdRef.current = jobId
  }, [jobId])

  const handleStatusChange = useCallback((newStatus: string) => {
    setStatus(newStatus)
    setServerJob((prev) => (prev ? { ...prev, status: newStatus } : prev))
  }, [])

  const handleProgressUpdate = useCallback(
    async (id: string, rendering: number, publishing: number, newStatus: string) => {
      if (id === jobIdRef.current) {
        setServerJob((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus,
                progress: {
                  rendering_progress: rendering,
                  publishing_progress: publishing,
                },
              }
            : prev
        )
      }

      onJobProgress?.(id, rendering, publishing, newStatus)

      if (
        (newStatus === "published" || newStatus === "failed") &&
        refreshAllJobs
      ) {
        await refreshAllJobs()
      }
    },
    [onJobProgress, refreshAllJobs]
  )

  const progress = useJobProgress(
    jobId,
    status,
    handleStatusChange,
    handleProgressUpdate
  )

  const handleCreateJob = useCallback(async () => {
    try {
      setIsCreatingJob(true)
      setError(null)

      const res = await createJob({
        title: editor.title,
        description: editor.description,
        assets: [],
      })

      setJobId(res.job_id)
      setStatus(res.status)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job")
    } finally {
      setIsCreatingJob(false)
    }
  }, [editor.title, editor.description])

  const handleUploadAssets = useCallback(async () => {
    if (!jobId) {
      setError("Create a job first")
      return
    }

    try {
      setIsUploadingAssets(true)
      setError(null)

      const assets: UploadAsset[] = []

      if (editor.thumbnail) {
        assets.push({
          kind: "thumbnail",
          filename: editor.thumbnail.file.name,
          content_type: editor.thumbnail.file.type,
          size_bytes: editor.thumbnail.file.size,
        })
      }

      editor.clips.forEach((clip) => {
        assets.push({
          kind: "clip",
          filename: clip.file.name,
          content_type: clip.file.type,
          size_bytes: clip.file.size,
          sequence: clip.sequence,
        })
      })

      const res = await addAssets(jobId, { assets })

      for (const instruction of res.uploads) {
        if (instruction.kind === "thumbnail" && editor.thumbnail) {
          await uploadFile(instruction, editor.thumbnail.file, (percent) => {
            editor.setThumbnailUploadProgress(percent)
          })
          continue
        }

        if (instruction.kind === "clip") {
          const match = editor.clips.find(
            (clip) => clip.file.name === instruction.filename
          )

          if (match) {
            await uploadFile(instruction, match.file, (percent) => {
              editor.setClipUploadProgress(match.id, percent)
            })
          }
        }
      }

      if (autoSubmitAfterUpload) {
        setIsSubmittingJob(true)
        const submitRes = await submitJob(jobId)
        setStatus(submitRes.status)

        const job = await getJob(jobId)
        setServerJob(job)
        setStatus(job.status)
      }

      await refreshAllJobs?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload assets")
    } finally {
      setIsUploadingAssets(false)
      setIsSubmittingJob(false)
    }
  }, [jobId, editor, autoSubmitAfterUpload, refreshAllJobs])

  const handleSubmitJob = useCallback(async () => {
    if (!jobId) {
      setError("Create a job first")
      return
    }

    try {
      setIsSubmittingJob(true)
      setError(null)

      const res = await submitJob(jobId)
      setStatus(res.status)

      const job = await getJob(jobId)
      setServerJob(job)
      setStatus(job.status)

      await refreshAllJobs?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit job")
    } finally {
      setIsSubmittingJob(false)
    }
  }, [jobId, refreshAllJobs])

  const handleRefreshStatus = useCallback(async () => {
    if (!jobId) {
      setError("Create a job first")
      return
    }

    try {
      setIsRefreshingStatus(true)
      setError(null)

      const job = await getJob(jobId)
      setServerJob(job)
      setStatus(job.status)

      await refreshAllJobs?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch job status")
    } finally {
      setIsRefreshingStatus(false)
    }
  }, [jobId, refreshAllJobs])

  const handleLoadJob = useCallback(
    async (id: string) => {
      try {
        setError(null)
        const job = await getJob(id)

        setJobId(id)
        setStatus(job.status)
        setServerJob(job)

        editor.loadEditor({
          title: job.title,
          description: job.description,
          clearAssets: true,
        })

        await refreshAllJobs?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load job")
      }
    },
    [editor, refreshAllJobs]
  )

  return {
    jobId,
    status,
    serverJob,
    error,
    isCreatingJob,
    isUploadingAssets,
    isSubmittingJob,
    isRefreshingStatus,
    autoSubmitAfterUpload,
    setAutoSubmitAfterUpload,

    handleCreateJob,
    handleUploadAssets,
    handleSubmitJob,
    handleRefreshStatus,
    handleLoadJob,

    progress,
    setError,
    setJobId,
    setStatus,
    setServerJob,
  }
}