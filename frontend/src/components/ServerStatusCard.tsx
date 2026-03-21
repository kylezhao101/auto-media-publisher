import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { JobStatusResponse } from "@/types/job"

type ServerStatusCardProps = {
    serverJob: JobStatusResponse | null
    progress?: number
}

const RENDERING_STATUSES = ["queued", "rendering"]

export default function ServerStatusCard({ serverJob, progress = 0 }: ServerStatusCardProps) {
    const isRendering = serverJob && RENDERING_STATUSES.includes(serverJob.status)

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
                                    <span>{progress}%</span>
                                </div>
                                <Progress value={progress} className="h-2" />
                            </div>
                        )}

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
                            <div className="text-destructive">Error: {serverJob.error}</div>
                        )}
                    </>
                )}
            </CardContent>
        </Card >
    )
}