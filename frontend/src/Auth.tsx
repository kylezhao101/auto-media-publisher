import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"

import { supabase } from "@/lib/supabase"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { FcGoogle } from "react-icons/fc"


type AuthMode =
    | "login"
    | "signup"
    | "forgot-password"
    | "update-password"


export function Auth({
    children,
}: {
    children: ReactNode
}) {
    const [session, setSession] =
        useState<Session | null>(null)

    const [loading, setLoading] =
        useState(true)

    const [mode, setMode] =
        useState<AuthMode>("login")

    const [email, setEmail] =
        useState("")

    const [password, setPassword] =
        useState("")

    const [confirmPassword, setConfirmPassword] =
        useState("")

    const [error, setError] =
        useState<string | null>(null)

    const [message, setMessage] =
        useState<string | null>(null)


    useEffect(() => {
        async function initializeAuth() {
            const hashParams =
                new URLSearchParams(
                    window.location.hash.substring(1),
                )

            const accessToken =
                hashParams.get("access_token")

            const refreshToken =
                hashParams.get("refresh_token")


            if (accessToken && refreshToken) {
                const {
                    data,
                    error,
                } = await supabase.auth.setSession({
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
                    setEmail(
                        data.session.user.email,
                    )
                }

                setLoading(false)
                return
            }


            const { data } =
                await supabase.auth.getSession()

            setSession(data.session)

            if (data.session?.user.email) {
                setEmail(
                    data.session.user.email,
                )
            }

            setLoading(false)
        }


        initializeAuth()


        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setSession(session)

                if (session?.user.email) {
                    setEmail(
                        session.user.email,
                    )
                }

                if (
                    event ===
                    "PASSWORD_RECOVERY"
                ) {
                    setMode(
                        "update-password",
                    )
                }
            },
        )


        return () => {
            subscription.unsubscribe()
        }
    }, [])


    function clearFeedback() {
        setError(null)
        setMessage(null)
    }


    async function login() {
        clearFeedback()

        if (!email.trim()) {
            setError("Enter your email.")
            return
        }

        if (!password) {
            setError("Enter your password.")
            return
        }

        const { error } =
            await supabase.auth.signInWithPassword(
                {
                    email: email.trim(),
                    password,
                },
            )

        if (error) {
            setError(error.message)
        }
    }


    async function signup() {
        clearFeedback()

        if (!email.trim()) {
            setError("Enter your email.")
            return
        }

        if (!password) {
            setError("Enter a password.")
            return
        }

        if (password !== confirmPassword) {
            setError(
                "Passwords do not match.",
            )
            return
        }


        const { error } =
            await supabase.auth.signUp({
                email: email.trim(),
                password,

                options: {
                    emailRedirectTo:
                        window.location.href,
                },
            })


        if (error) {
            setError(error.message)
            return
        }


        setMessage(
            "Check your email to confirm your account.",
        )
    }


    async function forgotPassword() {
        clearFeedback()

        if (!email.trim()) {
            setError("Enter your email.")
            return
        }


        const redirectUrl = new URL(
            "/",
            window.location.origin,
        )


        const { error } =
            await supabase.auth.resetPasswordForEmail(
                email.trim(),
                {
                    redirectTo:
                        redirectUrl.toString(),
                },
            )


        if (error) {
            setError(error.message)
            return
        }


        setMessage(
            "Check your email for a password reset link.",
        )
    }


    async function updatePassword() {
        clearFeedback()

        if (!password) {
            setError("Enter a password.")
            return
        }

        if (password !== confirmPassword) {
            setError(
                "Passwords do not match.",
            )
            return
        }


        const { error } =
            await supabase.auth.updateUser({
                password,
            })


        if (error) {
            setError(error.message)
            return
        }


        setPassword("")
        setConfirmPassword("")

        setMessage(
            "Password updated.",
        )

        window.history.replaceState(
            {},
            "",
            window.location.pathname,
        )

        setMode("login")
    }


    async function signInWithGoogle() {
        clearFeedback()

        // Preserve the current route and query string.
        //
        // Example:
        // /invite?invite=abc123
        //      ↓ Google
        // /invite?invite=abc123
        const redirectUrl =
            window.location.href


        const { error } =
            await supabase.auth.signInWithOAuth({
                provider: "google",

                options: {
                    redirectTo:
                        redirectUrl,
                },
            })


        if (error) {
            setError(error.message)
        }
    }


    function switchMode(
        nextMode: AuthMode,
    ) {
        setMode(nextMode)

        setPassword("")
        setConfirmPassword("")

        clearFeedback()
    }


    if (loading) {
        return null
    }


    if (
        session &&
        mode !== "update-password"
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
                        {mode === "login" &&
                            "Sign in to continue."}

                        {mode === "signup" &&
                            "Create your account."}

                        {mode ===
                            "forgot-password" &&
                            "Reset your password."}

                        {mode ===
                            "update-password" &&
                            "Choose a new password."}
                    </p>
                </div>


                {mode !==
                    "update-password" && (
                        <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(event) =>
                                setEmail(
                                    event.target.value,
                                )
                            }
                        />
                    )}


                {mode !==
                    "forgot-password" && (
                        <Input
                            type="password"
                            placeholder={
                                mode ===
                                    "update-password"
                                    ? "New password"
                                    : "Password"
                            }
                            value={password}
                            onChange={(event) =>
                                setPassword(
                                    event.target.value,
                                )
                            }
                            onKeyDown={(event) => {
                                if (
                                    event.key !==
                                    "Enter"
                                ) {
                                    return
                                }

                                if (
                                    mode === "login"
                                ) {
                                    login()
                                }
                            }}
                        />
                    )}


                {(mode === "signup" ||
                    mode ===
                    "update-password") && (
                        <Input
                            type="password"
                            placeholder="Confirm password"
                            value={confirmPassword}
                            onChange={(event) =>
                                setConfirmPassword(
                                    event.target.value,
                                )
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


                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-border" />

                            <span className="text-xs text-muted-foreground">
                                or
                            </span>

                            <div className="h-px flex-1 bg-border" />
                        </div>


                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={
                                signInWithGoogle
                            }
                        >
                            <FcGoogle className="size-4" />

                            Continue with Google
                        </Button>


                        <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() =>
                                switchMode(
                                    "signup",
                                )
                            }
                        >
                            Create account
                        </Button>


                        <Button
                            variant="link"
                            className="w-full"
                            onClick={() =>
                                switchMode(
                                    "forgot-password",
                                )
                            }
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


                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-border" />

                            <span className="text-xs text-muted-foreground">
                                or
                            </span>

                            <div className="h-px flex-1 bg-border" />
                        </div>


                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={
                                signInWithGoogle
                            }
                        >
                            <FcGoogle className="size-4" />

                            Continue with Google
                        </Button>


                        <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() =>
                                switchMode(
                                    "login",
                                )
                            }
                        >
                            Back to login
                        </Button>
                    </>
                )}


                {mode ===
                    "forgot-password" && (
                        <>
                            <Button
                                className="w-full"
                                onClick={
                                    forgotPassword
                                }
                            >
                                Send reset email
                            </Button>


                            <Button
                                variant="ghost"
                                className="w-full"
                                onClick={() =>
                                    switchMode(
                                        "login",
                                    )
                                }
                            >
                                Back to login
                            </Button>
                        </>
                    )}


                {mode ===
                    "update-password" && (
                        <Button
                            className="w-full"
                            onClick={
                                updatePassword
                            }
                        >
                            Set password
                        </Button>
                    )}

            </div>
        </main>
    )
}