import { useRef } from "react"
import { AspectRatio } from "./ui/aspect-ratio"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import type { LocalThumbnail } from "../types/dashboard"

type ThumbnailCardProps = {
    thumbnail: LocalThumbnail
    onThumbnailSelect: (file: File) => void
    onThumbnailRemove: () => void
}

export default function ThumbnailCard({
    thumbnail,
    onThumbnailSelect,
    onThumbnailRemove,
}: ThumbnailCardProps) {
    const inputRef = useRef<HTMLInputElement | null>(null)

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (file) onThumbnailSelect(file)
    }

    function handleRemove() {
        onThumbnailRemove()
        if (inputRef.current) inputRef.current.value = ""
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Thumbnail</CardTitle>
                <CardDescription>Upload a single image thumbnail.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="thumbnail-input">Thumbnail File</Label>
                    <Input
                        ref={inputRef}
                        id="thumbnail-input"
                        type="file"
                        accept="image/*"
                        onChange={handleChange}
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

                            <Button variant="outline" size="sm" onClick={handleRemove}>
                                Remove
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}