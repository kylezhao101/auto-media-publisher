import { uploadClient } from "@/lib/uploadClient"
import type { UploadInstruction } from "@/types/job"

export async function uploadFile(
  instruction: UploadInstruction,
  file: File
): Promise<void> {
  const { url, method, headers } = instruction

  await uploadClient.request({
    url,
    method,
    headers,
    data: file,
  })
}