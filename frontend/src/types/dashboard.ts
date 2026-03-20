export type LocalClip = {
  id: string
  file: File
  previewUrl: string
  sequence: number
  duration?: number
  progress: number
}

export type LocalThumbnail = {
  file: File
  previewUrl: string
  progress:number
} | null
