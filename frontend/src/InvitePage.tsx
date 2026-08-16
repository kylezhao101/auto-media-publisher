import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"

import { supabase } from "@/lib/supabase"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

import {
    Building2,
    Check,
    Mail,
} from "lucide-react"


const API_URL =
    import.meta.env.VITE_API_URL


type InvitationDetails = {
    organization_name: string
    email: string
    role: "admin" | "publisher" | "member"
    expires_at: string
}


type AcceptedInvitation = {
    organization_id: string
    role: string
}


export function InvitePage() {
    const [session, setSession] =
        useState<Session | null>(null)

    const [invitation, setInvitation] =
        useState<InvitationDetails | null>(null)

    const [loading, setLoading] =
        useState(true)

    const [accepting, setAccepting] =
        useState(false)

    const [accepted, setAccepted] =
        useState<AcceptedInvitation | null>(
            null,
        )

    const [error, setError] =
        useState<string | null>(null)


    const inviteToken =
        new URLSearchParams(
            window.location.search,
        ).get("invite")


    useEffect(() => {
        async function initialize() {
            if (!inviteToken) {
                setError(
                    "Invitation token missing.",
                )
                setLoading(false)
                return
            }

            try {
                const [
                    sessionResponse,
                    invitationResponse,
                ] = await Promise.all([
                    supabase.auth.getSession(),

                    fetch(
                        `${API_URL}/invitations/${inviteToken}`,
                    ),
                ])


                if (sessionResponse.error) {
                    throw sessionResponse.error
                }


                const invitationData =
                    await invitationResponse
                        .json()
                        .catch(() => null)


                if (!invitationResponse.ok) {
                    throw new Error(
                        invitationData?.detail ??
                        "Failed to load invitation.",
                    )
                }


                setSession(
                    sessionResponse.data.session,
                )

                setInvitation(
                    invitationData,
                )
            } catch (error) {
                setError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load invitation.",
                )
            } finally {
                setLoading(false)
            }
        }


        initialize()
    }, [inviteToken])


    async function acceptInvitation() {
        if (!inviteToken) {
            setError(
                "Invitation token missing.",
            )
            return
        }

        if (!session) {
            setError(
                "Authentication session missing.",
            )
            return
        }

        setAccepting(true)
        setError(null)

        try {
            const response = await fetch(
                `${API_URL}/invitations/${inviteToken}/accept`,
                {
                    method: "POST",

                    headers: {
                        Authorization:
                            `Bearer ${session.access_token}`,
                    },
                },
            )

            const data =
                await response
                    .json()
                    .catch(() => null)

            if (!response.ok) {
                throw new Error(
                    data?.detail ??
                    "Failed to accept invitation.",
                )
            }

            setAccepted({
                organization_id:
                    data.organization_id,

                role:
                    data.role,
            })
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Failed to accept invitation.",
            )
        } finally {
            setAccepting(false)
        }
    }


    async function signOut() {
        await supabase.auth.signOut()

        window.location.reload()
    }


    if (loading) {
        return (
            <main className="flex min-h-svh items-center justify-center bg-background p-6">
                <p className="text-sm text-muted-foreground">
                    Loading invitation...
                </p>
            </main>
        )
    }


    if (
        !inviteToken ||
        !invitation
    ) {
        return (
            <main className="flex min-h-svh items-center justify-center bg-background p-6">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>
                            Invalid invitation
                        </CardTitle>

                        <CardDescription>
                            {error ??
                                "This invitation could not be loaded."}
                        </CardDescription>
                    </CardHeader>
                </Card>
            </main>
        )
    }


    if (accepted) {
        return (
            <main className="flex min-h-svh items-center justify-center bg-background p-6">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                            <Check className="size-5" />
                        </div>

                        <CardTitle>
                            Invitation accepted
                        </CardTitle>

                        <CardDescription>
                            You joined{" "}
                            <span className="font-medium text-foreground">
                                {
                                    invitation.organization_name
                                }
                            </span>{" "}
                            as a{" "}
                            <span className="capitalize">
                                {accepted.role}
                            </span>
                            .
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <Button
                            className="w-full"
                            onClick={() => {
                                window.location.href =
                                    "/"
                            }}
                        >
                            Continue
                        </Button>
                    </CardContent>
                </Card>
            </main>
        )
    }


    const signedInEmail =
        session?.user.email?.toLowerCase()

    const invitedEmail =
        invitation.email.toLowerCase()

    const emailMatches =
        signedInEmail === invitedEmail


    return (
        <main className="flex min-h-svh items-center justify-center bg-background p-6">
            <Card className="w-full max-w-md">

                <CardHeader>
                    <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
                        <Building2 className="size-5 text-muted-foreground" />
                    </div>

                    <CardTitle>
                        Join{" "}
                        {invitation.organization_name}
                    </CardTitle>

                    <CardDescription>
                        You've been invited to join
                        this organization on Auto
                        Media Publisher.
                    </CardDescription>
                </CardHeader>


                <CardContent className="space-y-4">

                    <div className="grid gap-3 rounded-lg border border-border/60 p-4">

                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-muted-foreground">
                                Role
                            </span>

                            <Badge
                                variant="secondary"
                                className="capitalize"
                            >
                                {invitation.role}
                            </Badge>
                        </div>


                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-muted-foreground">
                                Invited email
                            </span>

                            <div className="flex items-center gap-1.5 text-sm font-medium">
                                <Mail className="size-3.5 text-muted-foreground" />

                                {invitation.email}
                            </div>
                        </div>

                    </div>


                    <div className="rounded-lg border border-border/60 p-4">
                        <p className="text-xs text-muted-foreground">
                            Signed in as
                        </p>

                        <p className="mt-1 text-sm font-medium">
                            {session?.user.email ??
                                "Unknown account"}
                        </p>
                    </div>


                    {!emailMatches && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                            <p className="text-sm text-destructive">
                                This invitation was sent
                                to {invitation.email}.
                                Sign in with that account
                                to accept it.
                            </p>
                        </div>
                    )}


                    {error && (
                        <p className="text-sm text-destructive">
                            {error}
                        </p>
                    )}


                    <Button
                        className="w-full"
                        onClick={
                            acceptInvitation
                        }
                        disabled={
                            accepting ||
                            !emailMatches
                        }
                    >
                        {accepting
                            ? "Accepting..."
                            : "Accept invitation"}
                    </Button>


                    <Button
                        variant="ghost"
                        className="w-full"
                        onClick={signOut}
                    >
                        Not the right account?
                        Sign out
                    </Button>

                </CardContent>
            </Card>
        </main>
    )
}