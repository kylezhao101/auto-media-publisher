import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { JobStatusResponse } from "@/types/job"

type ServerStatusCardProps = {
    serverJob: JobStatusResponse | null
    progress?: {
        rendering_progress?: number
        publishing_progress?: number
    }
}

const RENDERING_STATUSES = ["queued", "rendering", "rendered", "publishing", "published"]
const PUBLISHING_STATUSES = ["rendered", "publishing", "published"]

export default function ServerStatusCard({ serverJob, progress: { rendering_progress = 0, publishing_progress = 0 } = {} }: ServerStatusCardProps) {

    const renderingProgress = serverJob?.progress?.rendering_progress ?? rendering_progress
    const publishingProgress = serverJob?.progress?.publishing_progress ?? publishing_progress

    const isRendering = serverJob && (RENDERING_STATUSES.includes(serverJob.status) || renderingProgress > 0)
    const isPublishing = serverJob && (PUBLISHING_STATUSES.includes(serverJob.status) || publishingProgress > 0)

    return (
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

                        {isRendering && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Rendering</span>
                                    <span>{renderingProgress}%</span>
                                </div>
                                <Progress value={renderingProgress} className="h-2" />
                            </div>
                        )}

                        {isPublishing && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Publishing</span>
                                    <span>{publishingProgress}%</span>
                                </div>
                                <Progress value={publishingProgress} className="h-2" />
                            </div>
                        )}

                        <div>
                            <span className="text-muted-foreground">Assets:</span>{" "}
                            <span>{serverJob.assets.length}</span>
                        </div>

                        {serverJob.youtube_video_id && (
                            <div>
                                <a
                                    href={`https://www.youtube.com/watch?v=${serverJob.youtube_video_id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline underline-offset-4"
                                >
                                    View uploaded video
                                </a>
                            </div>
                        )}

                        {serverJob.error && (
                            <div className="text-destructive">Error: {serverJob.error}</div>
                        )}
                    </>
                )}
            </CardContent>
        </Card >
    )
}