import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

import { Badge } from "@/components/ui/badge"

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

import { RefreshCw } from "lucide-react"

import type {
    OrganizationAuditLogsState,
} from "@/hooks/useOrganizationAuditLogs"

import type {
    OrganizationAuditLog,
    OrganizationMember,
} from "@/api/organizations"


type Props = {
    auditLogs: OrganizationAuditLogsState
    members: OrganizationMember[]
}


export function OrganizationActivity({
    auditLogs,
    members,
}: Props) {
    const {
        logs,
        loading,
        error,
        refresh,
    } = auditLogs


    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <CardTitle>
                            Activity
                        </CardTitle>

                        <CardDescription>
                            Recent activity in your organization.
                        </CardDescription>
                    </div>

                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                            void refresh()
                        }
                        disabled={loading}
                        title="Refresh activity"
                        aria-label="Refresh activity"
                    >
                        <RefreshCw
                            className={`size-4 ${loading
                                ? "animate-spin"
                                : ""
                                }`}
                        />
                    </Button>
                </div>
            </CardHeader>


            <CardContent>
                {error ? (
                    <p className="text-sm text-destructive">
                        {error}
                    </p>

                ) : loading && logs.length === 0 ? (
                    <div className="flex h-24 items-center justify-center">
                        <p className="text-sm text-muted-foreground">
                            Loading activity...
                        </p>
                    </div>

                ) : logs.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            No activity yet.
                        </p>
                    </div>

                ) : (
                    <div className="max-h-[420px] overflow-y-auto pr-3">
                        {logs.map((log, index) => {
                            const actor =
                                findMember(
                                    members,
                                    log.actor_user_id,
                                )

                            const actorName =
                                getMemberName(
                                    actor,
                                    log.actor_email,
                                )

                            return (
                                <div key={log.id}>
                                    <div className="flex gap-3 py-4">
                                        <Avatar className="size-8">
                                            {actor?.avatar_url && (
                                                <AvatarImage
                                                    src={
                                                        actor.avatar_url
                                                    }
                                                    alt={
                                                        actorName
                                                    }
                                                />
                                            )}

                                            <AvatarFallback>
                                                {getInitials(
                                                    actorName,
                                                )}
                                            </AvatarFallback>
                                        </Avatar>


                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="text-sm">
                                                        <span className="font-medium">
                                                            {
                                                                actorName
                                                            }
                                                        </span>{" "}

                                                        {getActionText(
                                                            log,
                                                            members,
                                                        )}
                                                    </p>

                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {new Date(
                                                            log.created_at,
                                                        ).toLocaleString()}
                                                    </p>
                                                </div>


                                                <Badge
                                                    variant="secondary"
                                                    className="shrink-0 capitalize"
                                                >
                                                    {getCategory(
                                                        log.action,
                                                    )}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>


                                    {index <
                                        logs.length - 1 && (
                                            <Separator />
                                        )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}


function findMember(
    members: OrganizationMember[],
    userId: string | null,
) {
    if (!userId) {
        return undefined
    }

    return members.find(
        (member) =>
            member.user_id === userId,
    )
}


function getMemberName(
    member: OrganizationMember | undefined,
    fallbackEmail?: string | null,
) {
    return (
        member?.display_name ||
        member?.email ||
        fallbackEmail ||
        "System"
    )
}


function getInitials(
    value: string,
) {
    const parts = value
        .trim()
        .split(/\s+/)

    if (parts.length >= 2) {
        return (
            parts[0][0] +
            parts[1][0]
        ).toUpperCase()
    }

    return value
        .slice(0, 2)
        .toUpperCase()
}


function getCategory(
    action: string,
) {
    return action.split(".")[0]
}


function getActionText(
    log: OrganizationAuditLog,
    members: OrganizationMember[],
) {
    switch (log.action) {
        case "member.invited":
            return (
                <>
                    invited{" "}
                    <strong>
                        {String(
                            log.details.email,
                        )}
                    </strong>{" "}
                    as{" "}
                    <strong>
                        {String(
                            log.details.role,
                        )}
                    </strong>
                </>
            )


        case "member.joined":
            return (
                <>
                    joined as{" "}
                    <strong>
                        {String(
                            log.details.role,
                        )}
                    </strong>
                </>
            )


        case "member.left":
            return (
                "left the organization"
            )


        case "member.removed": {
            const member =
                findMember(
                    members,
                    getDetailString(
                        log,
                        "member_user_id",
                    ),
                )

            const memberName =
                getMemberName(
                    member,
                    getDetailString(
                        log,
                        "member_email",
                    ),
                )

            return (
                <>
                    removed{" "}
                    <strong>
                        {memberName === "System"
                            ? "a member"
                            : memberName}
                    </strong>
                </>
            )
        }


        case "member.role_updated": {
            const member =
                findMember(
                    members,
                    getDetailString(
                        log,
                        "member_user_id",
                    ),
                )

            const memberName =
                getMemberName(
                    member,
                    getDetailString(
                        log,
                        "member_email",
                    ),
                )

            return (
                <>
                    changed{" "}
                    <strong>
                        {memberName === "System"
                            ? "a member"
                            : memberName}
                    </strong>{" "}
                    from{" "}
                    <strong>
                        {String(
                            log.details.old_role,
                        )}
                    </strong>{" "}
                    to{" "}
                    <strong>
                        {String(
                            log.details.new_role,
                        )}
                    </strong>
                </>
            )
        }


        case "invitation.revoked":
            return (
                <>
                    revoked the invitation for{" "}
                    <strong>
                        {String(
                            log.details.email,
                        )}
                    </strong>
                </>
            )


        case "preset.created":
            return (
                <>
                    created preset{" "}
                    <strong>
                        {String(
                            log.details.preset_name,
                        )}
                    </strong>
                </>
            )


        case "preset.updated":
            return (
                <>
                    updated preset{" "}
                    <strong>
                        {String(
                            log.details.preset_name,
                        )}
                    </strong>
                </>
            )


        case "preset.deleted":
            return (
                <>
                    deleted preset{" "}
                    <strong>
                        {String(
                            log.details.preset_name,
                        )}
                    </strong>
                </>
            )


        case "youtube.connected":
            return (
                <>
                    connected YouTube channel{" "}
                    <strong>
                        {String(
                            log.details.channel_name,
                        )}
                    </strong>
                </>
            )


        case "youtube.disconnected":
            return (
                <>
                    disconnected YouTube channel{" "}
                    <strong>
                        {String(
                            log.details.channel_name,
                        )}
                    </strong>
                </>
            )


        default:
            return log.action
    }
}


function getDetailString(
    log: OrganizationAuditLog,
    key: string,
): string | null {
    const value =
        log.details[key]

    return typeof value === "string"
        ? value
        : null
}