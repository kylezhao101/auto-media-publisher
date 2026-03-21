import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"

type ActionsCardProps = {
    jobId: string | null
    isUploadingAssets: boolean
    isSubmittingJob: boolean
    isRefreshingStatus: boolean
    autoSubmitAfterUpload: boolean
    onAutoSubmitChange: (checked: boolean) => void
    onUploadAssets: () => void
    onSubmitJob: () => void
    onRefreshStatus: () => void
}

export default function ActionsCard({
    jobId,
    isUploadingAssets,
    isSubmittingJob,
    isRefreshingStatus,
    autoSubmitAfterUpload,
    onAutoSubmitChange,
    onUploadAssets,
    onSubmitJob,
    onRefreshStatus,
}: ActionsCardProps) {
    const isDisabled = !jobId
    const isUploadDisabled = isUploadingAssets || isSubmittingJob || isDisabled
    const isSubmitDisabled = isSubmittingJob || isUploadingAssets || isDisabled
    const isRefreshDisabled = isRefreshingStatus || isDisabled

    return (
        <Card>
            <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>Run the upload flow step by step.</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                        <Label htmlFor="auto-submit">Auto-submit after upload</Label>
                        <p className="text-sm text-muted-foreground">
                            Automatically queue the job once all uploads finish.
                        </p>
                    </div>

                    <Switch
                        id="auto-submit"
                        checked={autoSubmitAfterUpload}
                        onCheckedChange={onAutoSubmitChange}
                    />
                </div>

                <Button onClick={onUploadAssets} disabled={isUploadDisabled}>
                    {isUploadingAssets && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {autoSubmitAfterUpload ? "Upload & Submit" : "Upload Assets"}
                </Button>

                {!autoSubmitAfterUpload && (
                    <Button onClick={onSubmitJob} disabled={isSubmitDisabled}>
                        Submit Job
                    </Button>
                )}

                <Button
                    variant="secondary"
                    onClick={onRefreshStatus}
                    disabled={isRefreshDisabled}
                >
                    Refresh Status
                </Button>
            </CardContent>
        </Card>
    )
}