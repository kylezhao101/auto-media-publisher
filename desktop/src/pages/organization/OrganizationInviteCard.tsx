import { useState } from "react"

import {
    Info,
    Mail,
    MoreHorizontal,
} from "lucide-react"

import { Button } from "@/components/ui/button"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { OrganizationState } from "@/hooks/useOrganization"

import type {
    OrganizationInviteRole,
    OrganizationRole,
} from "@/api/organizations"


type Props = {
    workspace: string
    organization: OrganizationState
    currentUserRole?: OrganizationRole
}


export function OrganizationInviteCard({
    workspace,
    organization,
    currentUserRole,
}: Props) {
    const {
        invitations,
        loadingInvitations,
        invitationsError,
        inviteMember,
        revokeInvitation,
    } = organization

    const [email, setEmail] = useState("")

    const [role, setRole] =
        useState<OrganizationInviteRole>("publisher")

    const [sending, setSending] =
        useState(false)

    const [error, setError] =
        useState<string | null>(null)


    const canInvite =
        currentUserRole === "owner" ||
        currentUserRole === "admin"


    async function handleInvite() {
        const normalizedEmail =
            email.trim().toLowerCase()

        if (!normalizedEmail) {
            return
        }

        setSending(true)
        setError(null)

        try {
            await inviteMember(
                workspace,
                normalizedEmail,
                role,
            )

            setEmail("")
            setRole("publisher")
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Failed to send invitation",
            )
        } finally {
            setSending(false)
        }
    }


    if (!canInvite) {
        return null
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    Invite member
                </CardTitle>

                <CardDescription>
                    Invite someone to join this organization.
                </CardDescription>
            </CardHeader>


            <CardContent className="space-y-5">

                {/* Role descriptions */}
                <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                    <div className="flex gap-3">
                        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

                        <div className="grid flex-1 gap-2 text-sm">

                            {currentUserRole === "owner" && (
                                <div className="grid grid-cols-[90px_1fr] gap-3">
                                    <span className="font-medium">
                                        Admin
                                    </span>

                                    <span className="text-muted-foreground">
                                        Full organization access, including members, settings, presets,
                                        YouTube connections, and publishing.
                                    </span>
                                </div>
                            )}


                            <div className="grid grid-cols-[90px_1fr] gap-3">
                                <span className="font-medium">
                                    Publisher
                                </span>

                                <span className="text-muted-foreground">
                                    Can publish organization content using available presets and
                                    publishing resources.
                                </span>
                            </div>


                            <div className="grid grid-cols-[90px_1fr] gap-3">
                                <span className="font-medium">
                                    Member
                                </span>

                                <span className="text-muted-foreground">
                                    Can view organization resources, presets, and publishing history, but cannot publish or manage settings.
                                </span>
                            </div>

                        </div>
                    </div>
                </div>


                {/* Invite form */}
                <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">

                    {/* Email */}
                    <div className="grid gap-2">
                        <label
                            htmlFor="organization-invite-email"
                            className="text-sm font-medium"
                        >
                            Email
                        </label>

                        <Input
                            id="organization-invite-email"
                            type="email"
                            placeholder="person@example.com"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    handleInvite()
                                }
                            }}
                        />
                    </div>


                    {/* Role */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">
                            Role
                        </label>

                        <Select
                            value={role}
                            onValueChange={(value) =>
                                setRole(
                                    value as OrganizationInviteRole,
                                )
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>

                            <SelectContent
                                alignItemWithTrigger={false}
                                side="bottom"
                                align="start"
                                sideOffset={4}
                                className="rounded-md border-border"
                            >
                                {currentUserRole === "owner" && (
                                    <SelectItem value="admin">
                                        Admin
                                    </SelectItem>
                                )}

                                <SelectItem value="publisher">
                                    Publisher
                                </SelectItem>

                                <SelectItem value="member">
                                    Member
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>


                    {/* Invite button */}
                    <Button
                        onClick={handleInvite}
                        disabled={
                            sending ||
                            !email.trim()
                        }
                    >
                        <Mail className="size-4" />

                        {sending
                            ? "Sending..."
                            : "Send invite"}
                    </Button>

                </div>


                {/* Errors */}
                {(error || invitationsError) && (
                    <p className="text-sm text-destructive">
                        {error ?? invitationsError}
                    </p>
                )}


                {/* Pending invitations */}
                {(invitations.length > 0) && (
                    <div className="space-y-3">

                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">
                                Pending invitations
                            </p>

                            {invitations.length > 0 && (
                                <Badge variant="outline">
                                    {invitations.length}
                                </Badge>
                            )}
                        </div>


                        <div className="divide-y divide-border/50 rounded-lg border border-border/50 px-3">

                            {loadingInvitations &&
                                invitations.length === 0 ? (
                                <div className="py-4 text-sm text-muted-foreground">
                                    Loading invitations...
                                </div>
                            ) : (
                                invitations.map(
                                    (invitation) => (
                                        <div
                                            key={invitation.id}
                                            className="flex items-center gap-3 py-3"
                                        >
                                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                                                <Mail className="size-4 text-muted-foreground" />
                                            </div>


                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">
                                                    {invitation.email}
                                                </p>

                                                <p className="text-xs text-muted-foreground">
                                                    Invitation pending
                                                </p>
                                            </div>


                                            <Badge
                                                variant="outline"
                                                className="capitalize"
                                            >
                                                {invitation.role}
                                            </Badge>


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

                                                <DropdownMenuContent
                                                    align="end"
                                                >
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onClick={() =>
                                                            revokeInvitation(
                                                                workspace,
                                                                invitation.id,
                                                            )
                                                        }
                                                    >
                                                        Revoke invitation
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    ),
                                )
                            )}

                        </div>
                    </div>
                )}

            </CardContent>
        </Card>
    )
}