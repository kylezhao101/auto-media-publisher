import {
    ExternalLink,
    MoreHorizontal,
    Unplug,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { OrganizationRole } from "@/api/organizations"
import type { YouTubeConnectionState } from "@/hooks/useYoutubeConnection"


type Props = {
    youtube: YouTubeConnectionState
    currentUserRole?: OrganizationRole

    onConnect: () => void | Promise<void>
    onDisconnect: () => void | Promise<void>
}


export function OrganizationYouTubeCard({
    youtube,
    currentUserRole,
    onConnect,
    onDisconnect,
}: Props) {
    const {
        connection,
        loading,
    } = youtube


    const canManage =
        currentUserRole === "owner" ||
        currentUserRole === "admin"


    const channelUrl =
        connection.channelHandle
            ? `https://www.youtube.com/${connection.channelHandle}`
            : connection.channelId
                ? `https://www.youtube.com/channel/${connection.channelId}`
                : null


    function openChannel() {
        if (!channelUrl) {
            return
        }

        window.electronAPI.openExternal(
            channelUrl,
        )
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    YouTube
                </CardTitle>

                <CardDescription>
                    Manage the YouTube channel used
                    when publishing from this organization.
                </CardDescription>
            </CardHeader>


            <CardContent>

                {loading && !connection.channelName && !connection.connected ? (
                    <div className="flex min-h-24 items-center justify-center rounded-lg border border-border/50">
                        <p className="text-sm text-muted-foreground">
                            Checking YouTube connection...
                        </p>
                    </div>
                ) : connection.connected ? (
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 p-4">

                        <div className="flex min-w-0 items-center gap-3">

                            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">

                                <img
                                    src={
                                        connection.channelThumbnail
                                    }
                                    alt={
                                        connection.channelName ??
                                        "YouTube channel"
                                    }
                                    className="size-full object-cover"
                                    referrerPolicy="no-referrer"
                                />

                            </div>


                            <div className="min-w-0">

                                <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-medium">
                                        {connection.channelName ??
                                            "YouTube channel"}
                                    </p>

                                    <Badge variant="success">
                                        Connected
                                    </Badge>
                                </div>


                                {connection.channelHandle && (
                                    <button
                                        type="button"
                                        onClick={
                                            openChannel
                                        }
                                        className="
                                            mt-1 flex max-w-full
                                            items-center gap-1
                                            text-sm text-muted-foreground
                                            hover:text-foreground
                                            hover:underline
                                        "
                                    >
                                        <span className="truncate">
                                            {
                                                connection.channelHandle
                                            }
                                        </span>

                                        <ExternalLink className="size-3 shrink-0" />
                                    </button>
                                )}

                            </div>
                        </div>


                        {canManage && (
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    render={
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-8"
                                        />
                                    }
                                >
                                    <MoreHorizontal className="size-4" />
                                </DropdownMenuTrigger>


                                <DropdownMenuContent align="end">

                                    {channelUrl && (
                                        <>
                                            <DropdownMenuItem
                                                onClick={
                                                    openChannel
                                                }
                                            >
                                                <ExternalLink className="size-4" />
                                                Open channel
                                            </DropdownMenuItem>

                                            <DropdownMenuSeparator />
                                        </>
                                    )}


                                    <DropdownMenuItem
                                        variant="destructive"
                                        onClick={
                                            onDisconnect
                                        }
                                    >
                                        <Unplug className="size-4" />
                                        Disconnect
                                    </DropdownMenuItem>

                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                    </div>
                ) : (
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 p-4">

                        <div className="flex min-w-0 items-center gap-3">
                            <div>
                                <p className="text-sm font-medium">
                                    No YouTube channel connected
                                </p>

                                <p className="mt-1 text-sm text-muted-foreground">
                                    Connect a channel to publish
                                    from this organization.
                                </p>
                            </div>

                        </div>


                        {canManage && (
                            <Button
                                onClick={
                                    onConnect
                                }
                            >
                                Connect YouTube
                            </Button>
                        )}

                    </div>
                )}

            </CardContent>
        </Card>
    )
}