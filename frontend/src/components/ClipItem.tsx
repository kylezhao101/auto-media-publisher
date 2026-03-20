import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import type { LocalClip } from "../types/dashboard"

type ClipItemProps = {
    clip: LocalClip
    isFirst: boolean
    isLast: boolean
    onMoveUp: () => void
    onMoveDown: () => void
    onRemove: () => void
}

export default function ClipItem({
    clip,
    isFirst,
    isLast,
    onMoveUp,
    onMoveDown,
    onRemove,
}: ClipItemProps) {
    return (
        <div className="grid gap-4 rounded-xl border p-4 md:grid-cols-[220px_1fr_auto]">
            <video
                src={clip.previewUrl}
                controls
                className="h-fit w-full rounded-md bg-black object-cover"
            />

            <div className="flex min-w-0 flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Badge variant="secondary">Clip {clip.sequence}</Badge>
                    {clip.progress !== undefined && (
                        <Badge variant="outline">{clip.progress}%</Badge>
                    )}
                </div>

                <p className="truncate text-sm font-medium">{clip.file.name}</p>

                <p className="text-xs text-muted-foreground">
                    {(clip.file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
            </div>

            <div className="flex flex-row gap-2 md:flex-col">
                <Button size="sm" variant="outline" onClick={onMoveUp} disabled={isFirst}>
                    Up
                </Button>

                <Button size="sm" variant="outline" onClick={onMoveDown} disabled={isLast}>
                    Down
                </Button>

                <Button size="sm" variant="destructive" onClick={onRemove}>
                    Remove
                </Button>
            </div>
        </div>
    )
}