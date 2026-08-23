import { useEffect, useState } from "react"
import type { OrganizationState } from "../hooks/useOrganization"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    UserRound,
    Mail,
    LogOut,
    HardDrive,
    ExternalLink
} from "lucide-react"
import { FcGoogle } from "react-icons/fc"
import { type YouTubeConnectionState } from "@/hooks/useYoutubeConnection"
import type { AuthStatus } from "@/types/amp"
import { OrganizationWorkspace } from "./organization/OrganizationWorkspace"
import {
    connectOrganizationYouTube,
    disconnectOrganizationYouTube,
} from "@/api/youtube"
import { type OrganizationAuditLogsState } from "@/hooks/useOrganizationAuditLogs"


type Props = {
    workspace: string
    organization: OrganizationState
    authStatus: AuthStatus
    youtube: YouTubeConnectionState
    auditLogs: OrganizationAuditLogsState
}


export function OrganizationPage({
    workspace,
    organization,
    authStatus,
    youtube,
    auditLogs
}: Props) {
    const {
        session,
        user,
        loading,
        signIn,
        signOut,
        signInWithGoogle,
        organizations,
        loadingOrganizations,
        organizationError,
    } = organization

    const {
        connection: youtubeConnection,
        loading: youtubeLoading,
    } = youtube

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)

    async function handleLogin() {
        setError(null)

        const { error } = await signIn(
            email,
            password,
        )

        if (error) {
            setError(error.message)
        }
    }

    async function handleConnectYouTube() {
        if (
            workspace === "local" ||
            !session
        ) {
            return
        }

        try {
            const data =
                await connectOrganizationYouTube(
                    workspace,
                    session.access_token,
                )

            await window.electronAPI.openExternal(
                data.authorization_url,
            )
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Failed to connect YouTube",
            )
        }
    }


    async function handleDisconnectYouTube() {
        if (
            workspace === "local" ||
            !session
        ) {
            return
        }

        try {
            await disconnectOrganizationYouTube(
                workspace,
                session.access_token,
            )

            youtube.clear()

        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Failed to disconnect YouTube",
            )
        }
    }

    useEffect(() => {
        if (workspace === "local") {
            return
        }

        void organization.refreshWorkspace(
            workspace,
        )
    }, [workspace])


    if (loading) {
        return (
            <div className="flex min-h-48 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                    Loading account...
                </p>
            </div>
        )
    }


    if (!session) {
        return (
            <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>
                            Sign in
                        </CardTitle>

                        <CardDescription>
                            Sign in to access organization features.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="flex flex-col gap-4">
                        <div className="grid gap-2">
                            <label
                                htmlFor="organization-email"
                                className="text-sm font-medium"
                            >
                                Email
                            </label>

                            <Input
                                id="organization-email"
                                type="email"
                                value={email}
                                onChange={(e) =>
                                    setEmail(e.target.value)
                                }
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleLogin()
                                    }
                                }}
                            />
                        </div>

                        <div className="grid gap-2">
                            <label
                                htmlFor="organization-password"
                                className="text-sm font-medium"
                            >
                                Password
                            </label>

                            <Input
                                id="organization-password"
                                type="password"
                                value={password}
                                onChange={(e) =>
                                    setPassword(e.target.value)
                                }
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleLogin()
                                    }
                                }}
                            />
                        </div>

                        {error && (
                            <p className="text-sm text-destructive">
                                {error}
                            </p>
                        )}

                        <Button onClick={handleLogin}>
                            Sign in
                        </Button>

                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-border" />

                            <span className="text-xs text-muted-foreground">
                                or
                            </span>

                            <div className="h-px flex-1 bg-border" />
                        </div>

                        <Button
                            variant="outline"
                            onClick={signInWithGoogle}
                        >
                            <FcGoogle className="size-4" />
                            Continue with Google
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }


    if (loadingOrganizations) {
        return (
            <div className="flex min-h-48 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                    Loading organizations...
                </p>
            </div>
        )
    }


    if (organizationError) {
        return (
            <Card>
                <CardContent className="py-6">
                    <p className="text-sm text-destructive">
                        {organizationError}
                    </p>
                </CardContent>
            </Card>
        )
    }


    const selectedOrganization = organizations.find(
        (org) => org.id === workspace,
    )


    if (workspace === "local") {
        return (
            <div className="flex flex-col gap-5">

                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                                    {user?.user_metadata?.avatar_url ? (
                                        <img
                                            src={user.user_metadata.avatar_url}
                                            alt=""
                                            className="size-full object-cover"
                                        />
                                    ) : (
                                        <UserRound className="size-5 text-muted-foreground" />
                                    )}
                                </div>

                                <div>
                                    <CardTitle>
                                        Personal workspace
                                    </CardTitle>

                                    <CardDescription>
                                        Your personal publishing environment on this device.
                                    </CardDescription>
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                onClick={signOut}
                            >
                                <LogOut className="size-4" />
                                Sign out
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">

                            <div className="rounded-lg border border-border/80 p-4">
                                <div className="flex items-center gap-2">
                                    <Mail className="size-4 text-muted-foreground" />

                                    <span className="text-sm font-medium">
                                        Account
                                    </span>
                                </div>

                                <p className="mt-2 truncate text-sm text-muted-foreground">
                                    {user?.email ?? "Unknown account"}
                                </p>
                            </div>


                            <div className="rounded-lg border border-border/80 p-4">
                                <div className="flex items-center gap-2">
                                    <HardDrive className="size-4 text-muted-foreground" />

                                    <span className="text-sm font-medium">
                                        Local data
                                    </span>
                                </div>

                                <p className="mt-2 text-sm text-muted-foreground">
                                    Publishing credentials and media processing stay on this device.
                                </p>
                            </div>

                        </div>
                    </CardContent>
                </Card>


                <Card>
                    <CardHeader>
                        <CardTitle>
                            Personal publishing
                        </CardTitle>

                        <CardDescription>
                            Connections used when publishing from your personal workspace.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="flex flex-col gap-4">
                        <div className="grid gap-3">

                            <div className="flex items-center justify-between rounded-lg border p-4 border-border/80">
                                <div>
                                    <p className="text-sm font-medium">
                                        Google Cloud credentials
                                    </p>

                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Used for local YouTube authentication.
                                    </p>
                                </div>

                                <Badge
                                    variant={
                                        authStatus.credentials
                                            ? "success"
                                            : "outline"
                                    }
                                >
                                    {authStatus.credentials
                                        ? "Loaded"
                                        : "Missing"}
                                </Badge>
                            </div>


                            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 p-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="size-10 shrink-0 overflow-hidden rounded-full bg-muted">
                                        {youtubeConnection.channelThumbnail ? (
                                            <img
                                                src={youtubeConnection.channelThumbnail}
                                                alt={youtubeConnection.channelName ?? "YouTube channel"}
                                                className="size-full object-cover"
                                                referrerPolicy="no-referrer"
                                            />
                                        ) : (
                                            <div className="flex size-full items-center justify-center">
                                                <UserRound className="size-4 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">
                                            YouTube
                                        </p>

                                        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-sm">
                                            <span className="truncate">
                                                {youtubeLoading
                                                    ? "Checking connection..."
                                                    : youtubeConnection.channelName ?? "Not connected"}
                                            </span>

                                            {youtubeConnection.channelHandle && (
                                                <>
                                                    <span className="text-muted-foreground">
                                                        ·
                                                    </span>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            window.electronAPI.openExternal(
                                                                `https://www.youtube.com/${youtubeConnection.channelHandle}`,
                                                            )
                                                        }
                                                        className="
                                                        truncate text-muted-foreground
                                                        hover:text-foreground hover:underline
                                                        flex items-center gap-1
                                                    "
                                                    >
                                                        {youtubeConnection.channelHandle}
                                                        <ExternalLink className="size-3" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <Badge
                                    variant={
                                        youtubeConnection.connected
                                            ? "success"
                                            : "outline"
                                    }
                                >
                                    {youtubeConnection.connected
                                        ? "Connected"
                                        : "Not connected"}
                                </Badge>
                            </div>

                        </div>

                        <p className="text-sm text-muted-foreground">
                            Manage these connections from the Publish page.
                        </p>
                    </CardContent>
                </Card>

            </div>
        )
    }


    if (!selectedOrganization) {
        return null
    }

    return (
        <OrganizationWorkspace
            workspace={workspace}
            organization={organization}
            selectedOrganization={selectedOrganization}
            youtube={youtube}
            auditLogs={auditLogs}
            onConnectYouTube={handleConnectYouTube}
            onDisconnectYouTube={handleDisconnectYouTube}
        />
    )
}