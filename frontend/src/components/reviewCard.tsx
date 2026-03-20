import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { LocalClip, LocalThumbnail } from "@/types/dashboard"

type ReviewCardProps = {
    title: string
    description: string
    thumbnail: LocalThumbnail
    clips: LocalClip[]
}

export default function ReviewCard({
    title,
    description,
    thumbnail,
    clips,
}: ReviewCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Review</CardTitle>
                <CardDescription>Quick summary before queueing the job.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 text-sm">
                <div>
                    <span className="text-muted-foreground">Title:</span> <span>{title || "—"}</span>
                </div>

                <div>
                    <span className="text-muted-foreground">Description:</span>{" "}
                    <span>{description || "—"}</span>
                </div>

                <div>
                    <span className="text-muted-foreground">Thumbnail:</span>{" "}
                    <span>{thumbnail?.file.name ?? "None"}</span>
                    {thumbnail?.progress !== undefined && (
                        <span className="ml-2 text-xs text-muted-foreground">
                            ({thumbnail.progress}%)
                        </span>
                    )}
                </div>

                <div>
                    <span className="text-muted-foreground">Clip count:</span> <span>{clips.length}</span>
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
                                    {clip.sequence}. {clip.file.name}{" "}
                                    {clip.progress !== undefined ? `| ${clip.progress}%` : ""}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}