import { Loader2 } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"

type JobDetailsCardProps = {
    title: string
    description: string
    isCreatingJob: boolean
    onTitleChange: (value: string) => void
    onDescriptionChange: (value: string) => void
    onCreateJob: () => void
}

export default function JobDetailsCard({
    title,
    description,
    isCreatingJob,
    onTitleChange,
    onDescriptionChange,
    onCreateJob,
}: JobDetailsCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Job Details</CardTitle>
                <CardDescription>Basic information for this upload job.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="job-title">Title</Label>
                    <Input
                        id="job-title"
                        placeholder="Sunday Service - March 9"
                        value={title}
                        onChange={(e) => onTitleChange(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="job-description">Description</Label>
                    <Textarea
                        id="job-description"
                        placeholder="Optional description"
                        value={description}
                        onChange={(e) => onDescriptionChange(e.target.value)}
                        rows={5}
                    />
                </div>

                <Button onClick={onCreateJob} disabled={isCreatingJob || !title.trim()}>
                    {isCreatingJob && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Job
                </Button>
            </CardContent>
        </Card>
    )
}