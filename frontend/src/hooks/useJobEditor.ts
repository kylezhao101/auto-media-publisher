import { useCallback, useEffect, useState } from "react"
import type { LocalClip, LocalThumbnail } from "../types/dashboard"

type LoadEditorArgs = {
  title?: string
  description?: string
  clearAssets?: boolean
}

export function useJobEditor() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [thumbnail, setThumbnail] = useState<LocalThumbnail>(null)
  const [clips, setClips] = useState<LocalClip[]>([])

  const resetEditor = useCallback(() => {
    setTitle("")
    setDescription("")

    setThumbnail((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })

    setClips((prev) => {
      prev.forEach((clip) => {
        if (clip.previewUrl) URL.revokeObjectURL(clip.previewUrl)
      })
      return []
    })
  }, [])

  const loadEditor = useCallback(({ title = "", description = "", clearAssets = true }: LoadEditorArgs) => {
    setTitle(title)
    setDescription(description)

    if (clearAssets) {
      setThumbnail((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
        return null
      })

      setClips((prev) => {
        prev.forEach((clip) => {
          if (clip.previewUrl) URL.revokeObjectURL(clip.previewUrl)
        })
        return []
      })
    }
  }, [])

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

  const setThumbnailUploadProgress = useCallback((percent: number) => {
    setThumbnail((prev) => (prev ? { ...prev, progress: percent } : prev))
  }, [])

  const setClipUploadProgress = useCallback((clipId: string, percent: number) => {
    setClips((prev) =>
      prev.map((clip) =>
        clip.id === clipId ? { ...clip, progress: percent } : clip
      )
    )
  }, [])

  useEffect(() => {
    return () => {
      setThumbnail((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
        return prev
      })

      setClips((prev) => {
        prev.forEach((clip) => {
          if (clip.previewUrl) URL.revokeObjectURL(clip.previewUrl)
        })
        return prev
      })
    }
  }, [])

  return {
    title,
    setTitle,
    description,
    setDescription,
    thumbnail,
    clips,

    handleThumbnailChange,
    removeThumbnail,
    handleClips,
    removeClip,
    moveClipUp,
    moveClipDown,

    setThumbnailUploadProgress,
    setClipUploadProgress,

    resetEditor,
    loadEditor,
  }
}