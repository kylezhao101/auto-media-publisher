import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { AspectRatio } from "@/components/ui/aspect-ratio"

import { addAssets, completeJob, createJob, getJob } from "@/lib/api"
import { uploadFile } from "@/lib/azure"
import type { JobStatusResponse, UploadAsset } from "@/types/job"

import { getApiLogs, subscribeApiLogs, clearApiLogs } from "@/lib/apiLogStore";
import type { ApiLogEntry } from "@/types/log";

import { Loader2 } from "lucide-react"

type LocalClip = {
  id: string
  file: File
  previewUrl: string
  sequence: number
  duration?: number
}

type LocalThumbnail = {
  file: File
  previewUrl: string
} | null

export function App() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState("not-created")

  const [thumbnail, setThumbnail] = useState<LocalThumbnail>(null)
  const [clips, setClips] = useState<LocalClip[]>([])

  const [serverJob, setServerJob] = useState<JobStatusResponse | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>(getApiLogs());

  useEffect(() => {
    const unsubscribe = subscribeApiLogs(setApiLogs);
    return () => {
      unsubscribe();
    };
  }, []);

  function handleThumbnailChange(file: File) {
    setThumbnail({
      file,
      previewUrl: URL.createObjectURL(file),
    })
  }

  function handleClips(files: FileList) {
    const mxfFiles = Array.from(files).filter((file) =>
      file.name.toLowerCase().endsWith(".mxf")
    )

    const newClips: LocalClip[] = mxfFiles.map((file, index) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      sequence: clips.length + index + 1,
    }))

    setClips((prev) => [...prev, ...newClips])
  }

  function removeClip(id: string) {
    const updated = clips.filter((clip) => clip.id !== id)
    setClips(updated.map((clip, index) => ({ ...clip, sequence: index + 1 })))
  }

  function moveClipUp(index: number) {
    if (index === 0) return
    const updated = [...clips]
      ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    setClips(updated.map((clip, i) => ({ ...clip, sequence: i + 1 })))
  }

  function moveClipDown(index: number) {
    if (index === clips.length - 1) return
    const updated = [...clips]
      ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
    setClips(updated.map((clip, i) => ({ ...clip, sequence: i + 1 })))
  }

  async function handleCreateJob() {
    try {
      setIsBusy(true)
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
      setIsBusy(false)
    }
  }

  async function handleUploadAssets() {
    if (!jobId) {
      setError("Create a job first")
      return
    }

    try {
      setIsBusy(true)
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
          await uploadFile(instruction, thumbnail.file)
          continue
        }

        if (instruction.kind === "clip") {
          const match = clips.find((clip) => clip.file.name === instruction.filename)
          if (match) {
            await uploadFile(instruction, match.file)
          }
        }
      }

      setStatus("uploaded")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload assets")
    } finally {
      setIsBusy(false)
    }
  }

  async function handleCompleteJob() {
    if (!jobId) {
      setError("Create a job first")
      return
    }

    try {
      setIsBusy(true)
      setError(null)

      const res = await completeJob(jobId)
      setStatus(res.status)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete job")
    } finally {
      setIsBusy(false)
    }
  }

  async function handleRefreshStatus() {
    if (!jobId) {
      setError("Create a job first")
      return
    }

    try {
      setIsBusy(true)
      setError(null)

      const job = await getJob(jobId)
      setServerJob(job)
      setStatus(job.status)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch job status")
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <main className="min-h-svh bg-background p-6 md:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Auto Media Publisher</h1>
          <p className="text-sm text-muted-foreground">
            Create a job, upload a thumbnail and ordered clips, then queue it for processing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Status: {status}</Badge>
          <Badge variant="outline">Job ID: {jobId ?? "Not created"}</Badge>
          {clips.length > 0 && <Badge variant="outline">{clips.length} clips</Badge>}
          {thumbnail && <Badge variant="outline">Thumbnail selected</Badge>}
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="text-sm text-destructive">Error: {error}</CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
                <CardDescription>Basic information for this upload job.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Sunday Service - March 9"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Optional description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                  />
                </div>

                <Button onClick={handleCreateJob} disabled={isBusy || !title.trim()}>
                  {"Create Job"}
                  {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Thumbnail</CardTitle>
                <CardDescription>Upload a single image thumbnail.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="thumbnail">Thumbnail File</Label>
                  <Input
                    id="thumbnail"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleThumbnailChange(file)
                    }}
                  />
                </div>

                {thumbnail && (
                  <div className="overflow-hidden rounded-xl border bg-muted/30">
                    <AspectRatio ratio={16 / 9}>
                      <img
                        src={thumbnail.previewUrl}
                        alt="Thumbnail preview"
                        className="h-full w-full object-cover"
                      />
                    </AspectRatio>
                    <div className="flex items-center justify-between p-3 text-sm">
                      <span className="truncate">{thumbnail.file.name}</span>
                      <Button variant="outline" size="sm" onClick={() => setThumbnail(null)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Clips</CardTitle>
                <CardDescription>
                  Upload one or more video clips and set their order.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clips">Clip Files</Label>
                  <Input
                    id="clips"
                    type="file"
                    accept=".mxf,video/mxf"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) handleClips(e.target.files)
                    }}
                  />
                </div>

                <ScrollArea className="">
                  <div className="flex flex-col gap-4">
                    {clips.map((clip, index) => (
                      <div
                        key={clip.id}
                        className="grid gap-4 rounded-xl border p-4 md:grid-cols-[220px_1fr_auto]"
                      >
                        <video
                          src={clip.previewUrl}
                          controls
                          className="h-fit w-full rounded-md bg-black object-cover"
                        />

                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Clip {clip.sequence}</Badge>
                          </div>
                          <p className="truncate text-sm font-medium">{clip.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(clip.file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>

                        <div className="flex flex-row gap-2 md:flex-col">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => moveClipUp(index)}
                            disabled={index === 0}
                          >
                            Up
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => moveClipDown(index)}
                            disabled={index === clips.length - 1}
                          >
                            Down
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeClip(clip.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}

                    {clips.length === 0 && (
                      <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                        No clips added yet.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>Run the upload flow step by step.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Button onClick={handleUploadAssets} disabled={isBusy || !jobId}>
                  Upload Assets
                </Button>
                <Button onClick={handleCompleteJob} disabled={isBusy || !jobId}>
                  Complete Job
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleRefreshStatus}
                  disabled={isBusy || !jobId}
                >
                  Refresh Status
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Review</CardTitle>
                <CardDescription>Quick summary before queueing the job.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Title:</span>{" "}
                  <span>{title || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Description:</span>{" "}
                  <span>{description || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Thumbnail:</span>{" "}
                  <span>{thumbnail?.file.name ?? "None"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Clip count:</span>{" "}
                  <span>{clips.length}</span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="font-medium">Clip Order</p>
                  {clips.length === 0 ? (
                    <p className="text-muted-foreground">No clips added.</p>
                  ) : (
                    <div className="space-y-1">
                      {clips.map((clip) => (
                        <div key={clip.id} className="truncate text-muted-foreground">
                          {clip.sequence}. {clip.file.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Server Status</CardTitle>
                <CardDescription>Latest job state from the backend.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!serverJob ? (
                  <p className="text-muted-foreground">No job status fetched yet.</p>
                ) : (
                  <>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      <span>{serverJob.status}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Assets:</span>{" "}
                      <span>{serverJob.assets.length}</span>
                    </div>

                    {serverJob.youtube_url && (
                      <div>
                        <a
                          href={serverJob.youtube_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline underline-offset-4"
                        >
                          View uploaded video
                        </a>
                      </div>
                    )}

                    {serverJob.error && (
                      <div className="text-destructive">
                        Error: {serverJob.error}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

          </div>

        </div>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>API Activity</CardTitle>
              <CardDescription>Recent backend and upload requests.</CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={clearApiLogs}
              disabled={apiLogs.length === 0}
            >
              Clear
            </Button>
          </CardHeader>

          <CardContent>
            {apiLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No API activity yet.</p>
            ) : (
              <ScrollArea className="min-h-24 pr-3">
                <div className="flex flex-col gap-3">
                  {apiLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border p-3 text-sm">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant={log.status === "success" ? "secondary" : "destructive"}>
                          {log.status}
                        </Badge>
                        <Badge variant="outline">{log.method}</Badge>
                        {log.label && <Badge variant="outline">{log.label}</Badge>}
                        <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                      </div>

                      <div className="mb-2 break-all font-mono text-xs text-muted-foreground">
                        {log.endpoint}
                      </div>

                      {log.request !== undefined && (
                        <div className="mb-2">
                          <div className="mb-1 text-xs font-medium text-muted-foreground">
                            Request
                          </div>
                          <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">
                            {JSON.stringify(log.request, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.response !== undefined && (
                        <div className="mb-2">
                          <div className="mb-1 text-xs font-medium text-muted-foreground">
                            Response
                          </div>
                          <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">
                            {JSON.stringify(log.response, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.error && (
                        <div>
                          <div className="mb-1 text-xs font-medium text-destructive">
                            Error
                          </div>
                          <pre className="overflow-x-auto rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                            {typeof log.error === "string"
                              ? log.error
                              : JSON.stringify(log.error, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default App