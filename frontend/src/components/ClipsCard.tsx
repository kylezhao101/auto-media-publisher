import { useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { ScrollArea } from "./ui/scroll-area"
import type { LocalClip } from "../types/dashboard"
import ClipItem from "./ClipItem"

type ClipsCardProps = {
    clips: LocalClip[]
    onClipsSelect: (files: FileList) => void
    onMoveClipUp: (index: number) => void
    onMoveClipDown: (index: number) => void
    onRemoveClip: (id: string) => void
}

export default function ClipsCard({
    clips,
    onClipsSelect,
    onMoveClipUp,
    onMoveClipDown,
    onRemoveClip,
}: ClipsCardProps) {
    const inputRef = useRef<HTMLInputElement | null>(null)

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files) {
            onClipsSelect(e.target.files)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Clips</CardTitle>
                <CardDescription>
                    Upload one or more video clips and set their order.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="clips-input">Clip Files</Label>
                    <Input
                        ref={inputRef}
                        id="clips-input"
                        type="file"
                        accept=".mxf,video/mxf"
                        multiple
                        onChange={handleChange}
                    />
                </div>

                <ScrollArea>
                    <div className="flex flex-col gap-4">
                        {clips.map((clip, index) => (
                            <ClipItem
                                key={clip.id}
                                clip={clip}
                                isFirst={index === 0}
                                isLast={index === clips.length - 1}
                                onMoveUp={() => onMoveClipUp(index)}
                                onMoveDown={() => onMoveClipDown(index)}
                                onRemove={() => onRemoveClip(clip.id)}
                            />
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
    )
}