import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { JobStatusResponse } from "@/types/job"
import { ScrollArea } from "@/components/ui/scroll-area"

type JobWithProgress = JobStatusResponse & {
    progress?: { rendering_progress: number; publishing_progress: number }
}


const STATUS_COLORS: Record<string, string> = {
    published: "border-green-500 text-green-600",
    queued: "border-yellow-500 text-yellow-600",
    uploading: "border-yellow-500 text-yellow-600",
    processing: "border-blue-500 text-blue-600",
    publishing: "border-purple-500 text-purple-600",
    failed: "border-red-500 text-red-600",
}

function formatDate(iso: string) {
    if (!iso) return "—"
    return new Date(iso).toLocaleString()
}

export default function AllJobsCard({ jobs }: { jobs: JobWithProgress[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>All Jobs</CardTitle>
                <CardDescription>Jobs submitted for processing.</CardDescription>
            </CardHeader>
            <ScrollArea className="h-96">
                <CardContent>
                    {jobs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No jobs yet.</p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {jobs.map((job) => (
                                <div key={job.job_id} className="rounded-lg border p-4 flex flex-col gap-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-medium text-sm">{job.title || "Untitled"}</span>
                                        <Badge variant="outline" className={STATUS_COLORS[job.status] ?? ""}>
                                            {job.status}
                                        </Badge>
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        Created: {formatDate(job.created_at || "")}
                                    </p>

                                    {job.progress && typeof job.progress === 'object' &&
                                        (job.progress.rendering_progress > 0 || job.progress.publishing_progress > 0) && (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                    <span>Rendering</span>
                                                    <span>{job.progress.rendering_progress}%</span>
                                                </div>
                                                <Progress value={job.progress.rendering_progress} />
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                    <span>Publishing</span>
                                                    <span>{job.progress.publishing_progress}%</span>
                                                </div>
                                                <Progress value={job.progress.publishing_progress} />
                                            </div>
                                        )}

                                    {job.youtube_video_id && (
                                        <a
                                            href={`https://youtube.com/watch?v=${job.youtube_video_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-500 hover:underline"
                                        >
                                            Watch on YouTube →
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                </CardContent>
            </ScrollArea>
        </Card >
    )
}