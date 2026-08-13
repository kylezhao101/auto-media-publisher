import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { createClient } from "@supabase/supabase-js"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"


const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_KEY,
)

const API_URL = "http://127.0.0.1:8000"


type AuthMode =
    | "login"
    | "signup"
    | "forgot-password"
    | "update-password"
    | "invitation"


export function Auth({
    children,
}: {
    children: ReactNode
}) {
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)

    const [mode, setMode] = useState<AuthMode>("login")

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")

    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)


    useEffect(() => {
        async function initializeAuth() {
            const hashParams = new URLSearchParams(
                window.location.hash.substring(1),
            )

            const authType = hashParams.get("type")
            const accessToken = hashParams.get("access_token")
            const refreshToken = hashParams.get("refresh_token")

            if (authType === "invite") {
                setMode("invitation")
            }

            if (accessToken && refreshToken) {
                const { data, error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                })

                if (error) {
                    setError(error.message)
                    setLoading(false)
                    return
                }

                setSession(data.session)

                if (data.session?.user.email) {
                    setEmail(data.session.user.email)
                }

                setLoading(false)
                return
            }

            const { data } = await supabase.auth.getSession()

            setSession(data.session)

            if (data.session?.user.email) {
                setEmail(data.session.user.email)
            }

            setLoading(false)
        }

        initializeAuth()

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session)

            if (session?.user.email) {
                setEmail(session.user.email)
            }

            if (event === "PASSWORD_RECOVERY") {
                setMode("update-password")
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    async function login() {
        setError(null)
        setMessage(null)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(error.message)
        }
    }


    async function signup() {
        setError(null)
        setMessage(null)

        const { error } = await supabase.auth.signUp({
            email,
            password,
        })

        if (error) {
            setError(error.message)
            return
        }

        setMessage("Check your email to confirm your account.")
    }


    async function forgotPassword() {
        setError(null)
        setMessage(null)

        const { error } = await supabase.auth.resetPasswordForEmail(
            email,
            {
                redirectTo: window.location.origin,
            },
        )

        if (error) {
            setError(error.message)
            return
        }

        setMessage("Check your email for a password reset link.")
    }


    async function updatePassword() {
        setError(null)
        setMessage(null)

        if (password !== confirmPassword) {
            setError("Passwords do not match.")
            return
        }

        const { error } = await supabase.auth.updateUser({
            password,
        })

        if (error) {
            setError(error.message)
            return
        }

        setMessage("Password updated.")

        window.history.replaceState(
            {},
            "",
            window.location.pathname,
        )

        setMode("login")
    }


    async function completeInvitation() {
        setError(null)
        setMessage(null)

        if (!session) {
            setError("Auth session missing!")
            return
        }

        if (!password) {
            setError("Enter a password.")
            return
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.")
            return
        }

        // 1. Set the invited user's password
        const { error } = await supabase.auth.updateUser({
            password,
        })

        if (error) {
            setError(error.message)
            return
        }

        // 2. Get our AMP invitation token from ?invite=...
        const params = new URLSearchParams(window.location.search)
        const invitationToken = params.get("invite")

        if (!invitationToken) {
            setError("Invitation token missing.")
            return
        }

        // 3. Accept the AMP organization invitation
        const response = await fetch(
            `${API_URL}/invitations/${invitationToken}/accept`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            },
        )

        if (!response.ok) {
            const data = await response.json()

            setError(
                data.detail ?? "Failed to accept organization invitation.",
            )
            return
        }

        // 4. Everything succeeded — remove invite/auth info from URL
        window.history.replaceState(
            {},
            "",
            window.location.pathname,
        )

        setMessage("Account setup complete.")
        setMode("login")
    }


    if (loading) {
        return null
    }


    // A normal authenticated user enters AMP.
    //
    // Invite and password-recovery sessions need to finish
    // setup before we render the actual app.
    if (
        session &&
        mode !== "update-password" &&
        mode !== "invitation"
    ) {
        return <>{children}</>
    }


    return (
        <main className="flex min-h-svh items-center justify-center bg-background p-6">
            <div className="w-full max-w-sm space-y-4">
                <div>
                    <h1 className="text-2xl font-semibold">
                        Auto Media Publisher
                    </h1>

                    <p className="text-sm text-muted-foreground">
                        {mode === "login" && "Sign in to continue."}

                        {mode === "signup" && "Create your account."}

                        {mode === "forgot-password" &&
                            "Reset your password."}

                        {mode === "update-password" &&
                            "Choose a new password."}

                        {mode === "invitation" &&
                            "Complete your account to join the organization."}
                    </p>
                </div>


                {mode === "invitation" && (
                    <Input
                        type="email"
                        value={email}
                        disabled
                    />
                )}


                {mode !== "update-password" &&
                    mode !== "invitation" && (
                        <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    )}


                {mode !== "forgot-password" && (
                    <Input
                        type="password"
                        placeholder={
                            mode === "invitation" ||
                                mode === "update-password"
                                ? "New password"
                                : "Password"
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                )}


                {(mode === "invitation" ||
                    mode === "update-password") && (
                        <Input
                            type="password"
                            placeholder="Confirm password"
                            value={confirmPassword}
                            onChange={(e) =>
                                setConfirmPassword(e.target.value)
                            }
                        />
                    )}


                {error && (
                    <p className="text-sm text-destructive">
                        {error}
                    </p>
                )}


                {message && (
                    <p className="text-sm text-muted-foreground">
                        {message}
                    </p>
                )}


                {mode === "login" && (
                    <>
                        <Button
                            className="w-full"
                            onClick={login}
                        >
                            Log in
                        </Button>

                        <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => {
                                setMode("signup")
                                setError(null)
                                setMessage(null)
                            }}
                        >
                            Create account
                        </Button>

                        <Button
                            variant="link"
                            className="w-full"
                            onClick={() => {
                                setMode("forgot-password")
                                setError(null)
                                setMessage(null)
                            }}
                        >
                            Forgot password?
                        </Button>
                    </>
                )}


                {mode === "signup" && (
                    <>
                        <Button
                            className="w-full"
                            onClick={signup}
                        >
                            Create account
                        </Button>

                        <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => setMode("login")}
                        >
                            Back to login
                        </Button>
                    </>
                )}


                {mode === "forgot-password" && (
                    <>
                        <Button
                            className="w-full"
                            onClick={forgotPassword}
                        >
                            Send reset email
                        </Button>

                        <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => setMode("login")}
                        >
                            Back to login
                        </Button>
                    </>
                )}


                {mode === "update-password" && (
                    <Button
                        className="w-full"
                        onClick={updatePassword}
                    >
                        Set password
                    </Button>
                )}


                {mode === "invitation" && (
                    <Button
                        className="w-full"
                        onClick={completeInvitation}
                    >
                        Set password and continue
                    </Button>
                )}
            </div>
        </main>
    )
}