import { uploadClient } from "@/lib/uploadClient"
import type { UploadInstruction } from "@/types/job"

export async function uploadFile(
  instruction: UploadInstruction,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  const { url, method, headers } = instruction

  await uploadClient.request({
    url,
    method,
    headers,
    data: file,
    onUploadProgress: (event) => {
      const total = event.total ?? file.size
      const percent = total > 0 ? Math.round((event.loaded * 100) / total) : 0
      onProgress?.(percent)
    },
  })
}