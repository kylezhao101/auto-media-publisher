import {
    Building2,
    MoreHorizontal,
    RefreshCw,
    UserRound,
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
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"

import { ScrollArea } from "@/components/ui/scroll-area"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { OrganizationState } from "@/hooks/useOrganization"
import type { Organization } from "@/api/organizations"
import { OrganizationInviteCard } from "./OrganizationInviteCard"

import type { YouTubeConnectionState } from "@/hooks/useYoutubeConnection"
import type { OrganizationAuditLogsState } from '@/hooks/useOrganizationAuditLogs';

import { OrganizationYouTubeCard } from "./OrganizationYouTubeCard"
import { OrganizationPresetsCard } from "./OrganizationPresetsCard"
import { OrganizationDangerZone } from "./OrganizationDangerZone"
import { OrganizationActivity } from "./OrganizationActivity"

type Props = {
    workspace: string
    organization: OrganizationState
    selectedOrganization: Organization
    youtube: YouTubeConnectionState
    auditLogs: OrganizationAuditLogsState

    onConnectYouTube: () => void | Promise<void>
    onDisconnectYouTube: () => void | Promise<void>
}


export function OrganizationWorkspace({
    workspace,
    organization,
    selectedOrganization,
    youtube,
    auditLogs,
    onConnectYouTube,
    onDisconnectYouTube,
}: Props) {
    const {
        user,
        members,
        loadingMembers,
        membersError,
        loadMembers,
        removeMember,
        updateMemberRole
    } = organization

    console.log(members)

    const currentMembership = members.find(
        (member) => member.user_id === user?.id,
    )

    const canManageMembers =
        currentMembership?.role === "owner" ||
        currentMembership?.role === "admin"

    return (
        <div className="flex flex-col gap-5">
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                                <Building2 className="size-5 text-muted-foreground" />
                            </div>

                            <div>
                                <CardTitle>
                                    {selectedOrganization.name}
                                </CardTitle>

                                <CardDescription>
                                    Organization publishing workspace.
                                </CardDescription>
                            </div>
                        </div>

                        {currentMembership && (
                            <Badge
                                variant="secondary"
                                className="capitalize"
                            >
                                {currentMembership.role}
                            </Badge>
                        )}
                    </div>
                </CardHeader>

                <CardContent>
                    <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                                {user?.user_metadata?.avatar_url ? (
                                    <img
                                        src={user.user_metadata.avatar_url}
                                        alt=""
                                        className="size-full object-cover"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <UserRound className="size-5 text-muted-foreground" />
                                )}
                            </div>

                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                    {user?.user_metadata?.full_name ??
                                        user?.user_metadata?.name ??
                                        user?.email}
                                </p>

                                <p className="truncate text-sm text-muted-foreground">
                                    {user?.email}
                                </p>
                            </div>
                        </div>

                        <Badge variant="outline">
                            You
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            <OrganizationYouTubeCard
                youtube={youtube}
                currentUserRole={currentMembership?.role}
                onConnect={onConnectYouTube}
                onDisconnect={onDisconnectYouTube}
            />

            <OrganizationPresetsCard
                workspace={workspace}
                organization={organization}
                currentUserRole={currentMembership?.role}
            />

            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <CardTitle>
                                Members
                            </CardTitle>

                            <CardDescription>
                                People with access to this organization.
                            </CardDescription>
                        </div>

                        <div className="flex items-center gap-2">
                            <Badge variant="outline">
                                {members.length}{" "}
                                {members.length === 1
                                    ? "member"
                                    : "members"}
                            </Badge>

                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                    loadMembers(workspace)
                                }
                                disabled={loadingMembers}
                                title="Refresh members"
                                aria-label="Refresh members"
                            >
                                <RefreshCw
                                    className={`size-4 ${loadingMembers
                                        ? "animate-spin"
                                        : ""
                                        }`}
                                />
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {membersError ? (
                        <p className="text-sm text-destructive">
                            {membersError}
                        </p>
                    ) : loadingMembers && members.length === 0 ? (
                        <div className="flex h-32 items-center justify-center">
                            <p className="text-sm text-muted-foreground">
                                Loading members...
                            </p>
                        </div>
                    ) : members.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                            No members found.
                        </div>
                    ) : (
                        <ScrollArea className="max-h-72">
                            <div className="divide-y divide-border/50">
                                {members.map((member) => {
                                    const isCurrentUser =
                                        member.user_id === user?.id

                                    const canManageTarget =
                                        canManageMembers &&
                                        member.role !== "owner" &&
                                        !isCurrentUser &&
                                        !(
                                            currentMembership?.role === "admin" &&
                                            member.role === "admin"
                                        )

                                    return (
                                        <div
                                            key={member.user_id}
                                            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                                        >
                                            <Avatar className="size-9">
                                                {member.avatar_url && (
                                                    <AvatarImage
                                                        src={member.avatar_url}
                                                        alt={
                                                            member.display_name ??
                                                            member.email
                                                        }
                                                    />
                                                )}

                                                <AvatarFallback>
                                                    {(
                                                        member.display_name ??
                                                        member.email ??
                                                        "?"
                                                    )
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0 flex-1">
                                                {member.display_name && (
                                                    <p className="truncate text-sm font-medium">
                                                        {member.display_name}
                                                    </p>
                                                )}

                                                <p
                                                    className={
                                                        member.display_name
                                                            ? "truncate text-xs text-muted-foreground"
                                                            : "truncate text-sm font-medium"
                                                    }
                                                >
                                                    {member.email ?? "Unknown member"}
                                                </p>
                                            </div>

                                            {isCurrentUser && (
                                                <Badge variant="outline">
                                                    You
                                                </Badge>
                                            )}

                                            <Badge
                                                variant={
                                                    member.role === "owner"
                                                        ? "secondary"
                                                        : "outline"
                                                }
                                                className="capitalize"
                                            >
                                                {member.role}
                                            </Badge>

                                            {canManageTarget && (
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
                                                        <DropdownMenuSub>
                                                            <DropdownMenuSubTrigger>
                                                                Change role
                                                            </DropdownMenuSubTrigger>

                                                            <DropdownMenuSubContent>
                                                                {currentMembership?.role === "owner" && (

                                                                    <DropdownMenuItem
                                                                        disabled={member.role === "admin"}
                                                                        onClick={() =>
                                                                            updateMemberRole(
                                                                                workspace,
                                                                                member.user_id,
                                                                                "admin",
                                                                            )
                                                                        }
                                                                    >
                                                                        Admin
                                                                    </DropdownMenuItem>
                                                                )}

                                                                <DropdownMenuItem
                                                                    disabled={member.role === "publisher"}
                                                                    onClick={() =>
                                                                        updateMemberRole(
                                                                            workspace,
                                                                            member.user_id,
                                                                            "publisher",
                                                                        )
                                                                    }
                                                                >
                                                                    Publisher
                                                                </DropdownMenuItem>

                                                                <DropdownMenuItem
                                                                    disabled={member.role === "member"}
                                                                    onClick={() =>
                                                                        updateMemberRole(
                                                                            workspace,
                                                                            member.user_id,
                                                                            "member",
                                                                        )
                                                                    }
                                                                >
                                                                    Member
                                                                </DropdownMenuItem>
                                                            </DropdownMenuSubContent>
                                                        </DropdownMenuSub>

                                                        <DropdownMenuSeparator />

                                                        <DropdownMenuItem
                                                            variant="destructive"
                                                            onClick={() =>
                                                                removeMember(
                                                                    workspace,
                                                                    member.user_id,
                                                                )
                                                            }
                                                        >
                                                            Remove member
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>

            <OrganizationInviteCard
                workspace={workspace}
                organization={organization}
                currentUserRole={currentMembership?.role}
            />

            <OrganizationActivity
                auditLogs={auditLogs}
                members={organization.members}
            />


            <OrganizationDangerZone
                organization={organization}
                selectedOrganization={selectedOrganization}
                currentUserRole={currentMembership?.role}
            />
        </div>
    )
}