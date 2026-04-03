import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
} from "@/components/ui/card"

import JobDetailsCard from "@/components/JobDetailsCard"
import ThumbnailCard from "@/components/ThumbnailCard"
// import { useApiLogs } from "./hooks/useApiLog"
import ClipsCard from "./components/ClipsCard"
import ActionsCard from "./components/ActionsCard"
import ReviewCard from "./components/reviewCard"
import ServerStatusCard from "./components/ServerStatusCard"
import { hasApiKey } from "@/store/apiKeyStore"
import { ApiKeyGate } from "@/components/ApiKeyGate"
import { useState } from "react"
import { useJobWorkflow } from "./hooks/useJobWorkflow"
import AllJobsCard from "./components/AllJobsCard"
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"

export function App() {

  const workflow = useJobWorkflow()
  const [authenticated, setAuthenticated] = useState(hasApiKey())
  const [jobIdInput, setJobIdInput] = useState("")


  if (!authenticated) {
    return <ApiKeyGate onAuthenticated={() => setAuthenticated(true)} />
  }

  console.log(workflow)

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
          <Badge variant="secondary">Status: {workflow.status}</Badge>
          <Badge variant="outline">Job ID: {workflow.jobId ?? "Not created"}</Badge>
          {workflow.clips.length > 0 && <Badge variant="outline">{workflow.clips.length} clips</Badge>}
          {workflow.thumbnail && <Badge variant="outline">Thumbnail selected</Badge>}

          <div className="flex items-center gap-2 ml-auto">
            <Input
              placeholder="Paste job ID to resume..."
              value={jobIdInput}
              onChange={(e) => setJobIdInput(e.target.value)}
              className="h-7 w-72 text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={!jobIdInput.trim()}
              onClick={() => {
                workflow.handleLoadJob(jobIdInput.trim())
                setJobIdInput("")
              }}
            >
              Load
            </Button>
          </div>
        </div>

        {workflow.error && (
          <Card className="border-destructive">
            <CardContent className="text-sm text-destructive">Error: {workflow.error}</CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-6">
            <JobDetailsCard
              title={workflow.title}
              description={workflow.description}
              isCreatingJob={workflow.isCreatingJob}
              onTitleChange={workflow.setTitle}
              onDescriptionChange={workflow.setDescription}
              onCreateJob={workflow.handleCreateJob}
            />

            <ThumbnailCard
              thumbnail={workflow.thumbnail}
              onThumbnailSelect={workflow.handleThumbnailChange}
              onThumbnailRemove={workflow.removeThumbnail}
            />

            <ClipsCard
              clips={workflow.clips}
              onClipsSelect={workflow.handleClips}
              onMoveClipUp={workflow.moveClipUp}
              onMoveClipDown={workflow.moveClipDown}
              onRemoveClip={workflow.removeClip}
            />
          </div>

          <div className="flex flex-col gap-6">
            <ActionsCard
              jobId={workflow.jobId}
              isUploadingAssets={workflow.isUploadingAssets}
              isSubmittingJob={workflow.isSubmittingJob}
              isRefreshingStatus={workflow.isRefreshingStatus}
              onUploadAssets={workflow.handleUploadAssets}
              onSubmitJob={workflow.handleSubmitJob}
              onRefreshStatus={workflow.handleRefreshStatus}
              autoSubmitAfterUpload={workflow.autoSubmitAfterUpload}
              onAutoSubmitChange={workflow.setAutoSubmitAfterUpload}
            />

            <ReviewCard
              title={workflow.title}
              description={workflow.description}
              thumbnail={workflow.thumbnail}
              clips={workflow.clips}
            />

            <ServerStatusCard
              serverJob={workflow.serverJob}
              progress={workflow.progress}
            />
          </div>
        </div>


        <AllJobsCard jobs={workflow.allJobs} />


        {/* <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>API Activity</CardTitle>
              <CardDescription>Recent backend and upload requests.</CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={clearLogs}
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
        </Card> */}
      </div>
    </main>
  )
}

export default App