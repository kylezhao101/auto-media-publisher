import { useState } from "react"
import { addAssets, submitJob, createJob, getJob } from "../lib/api"
import { uploadFile } from "../lib/azure"
import type { JobStatusResponse, UploadAsset } from "../types/job"
import type { LocalClip, LocalThumbnail } from "../types/dashboard"
import { useJobProgress } from "./useJobProgress"

export function useJobWorkflow() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState("not-created")

  const [thumbnail, setThumbnail] = useState<LocalThumbnail>(null)
  const [clips, setClips] = useState<LocalClip[]>([])
  const [serverJob, setServerJob] = useState<JobStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [isUploadingAssets, setIsUploadingAssets] = useState(false)
  const [isSubmittingJob, setIsSubmittingJob] = useState(false)
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false)

  const [autoSubmitAfterUpload, setAutoSubmitAfterUpload] = useState(false)

  const progress = useJobProgress(jobId, status, async (newStatus) => {
    setStatus(newStatus)
    if (jobId) {
      const job = await getJob(jobId)
      setServerJob(job)
    }
  })

  function handleThumbnailChange(file: File) {
    setThumbnail((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)

      return {
        file,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
      }
    })
  }

  function removeThumbnail() {
    setThumbnail((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }

  function handleClips(files: FileList) {
    const mxfFiles = Array.from(files).filter((file) =>
      file.name.toLowerCase().endsWith(".mxf")
    )

    setClips((prev) => {
      const newClips: LocalClip[] = mxfFiles.map((file, index) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        sequence: prev.length + index + 1,
        progress: 0,
      }))

      return [...prev, ...newClips]
    })
  }

  function removeClip(id: string) {
    setClips((prev) => {
      const target = prev.find((clip) => clip.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)

      const updated = prev.filter((clip) => clip.id !== id)
      return updated.map((clip, index) => ({ ...clip, sequence: index + 1 }))
    })
  }

  function moveClipUp(index: number) {
    setClips((prev) => {
      if (index === 0) return prev
      const updated = [...prev]
      ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
      return updated.map((clip, i) => ({ ...clip, sequence: i + 1 }))
    })
  }

  function moveClipDown(index: number) {
    setClips((prev) => {
      if (index === prev.length - 1) return prev
      const updated = [...prev]
      ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
      return updated.map((clip, i) => ({ ...clip, sequence: i + 1 }))
    })
  }

  async function handleCreateJob() {
    try {
      setIsCreatingJob(true)
      setError(null)

      const res = await createJob({
        title,
        description,
        assets: [],
      })

      setJobId(res.job_id)
      setStatus(res.status)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job")
    } finally {
      setIsCreatingJob(false)
    }
  }

  async function handleUploadAssets() {
    if (!jobId) {
      setError("Create a job first")
      return
    }

    try {
      setIsUploadingAssets(true)
      setError(null)

      const assets: UploadAsset[] = []

      if (thumbnail) {
        assets.push({
          kind: "thumbnail",
          filename: thumbnail.file.name,
          content_type: thumbnail.file.type,
          size_bytes: thumbnail.file.size,
        })
      }

      clips.forEach((clip) => {
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
        if (instruction.kind === "thumbnail" && thumbnail) {
          await uploadFile(instruction, thumbnail.file, (percent) => {
            setThumbnail((prev) =>
              prev ? { ...prev, progress: percent } : prev
            )
          })
          continue
        }

        if (instruction.kind === "clip") {
          const match = clips.find((clip) => clip.file.name === instruction.filename)

          if (match) {
            await uploadFile(instruction, match.file, (percent) => {
              setClips((prev) =>
                prev.map((clip) =>
                  clip.id === match.id ? { ...clip, progress: percent } : clip
                )
              )
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload assets")
    } finally {
      setIsUploadingAssets(false)
      setIsSubmittingJob(false)
    }
  }

  async function handleSubmitJob() {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit job")
    } finally {
      setIsSubmittingJob(false)
    }
  }

  async function handleRefreshStatus() {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch job status")
    } finally {
      setIsRefreshingStatus(false)
    }
  }

  return {
    title,
    setTitle,
    description,
    setDescription,
    jobId,
    status,
    thumbnail,
    clips,
    serverJob,
    error,
    isCreatingJob,
    isUploadingAssets,
    isSubmittingJob,
    isRefreshingStatus,
    autoSubmitAfterUpload,
    handleThumbnailChange,
    removeThumbnail,
    handleClips,
    removeClip,
    moveClipUp,
    moveClipDown,
    handleCreateJob,
    handleUploadAssets,
    handleSubmitJob,
    handleRefreshStatus,
    setAutoSubmitAfterUpload,
    progress,
  }
}