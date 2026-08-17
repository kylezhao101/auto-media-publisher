import { useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"

import { supabase } from "../helpers/supabase"

export function useAuth() {
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
    const handledOAuthCodes = new Set<string>()

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session)
            setLoading(false)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    useEffect(() => {
        const unsubscribe =
            window.electronAPI.onAuthCallback(
                async (callbackUrl) => {
                    console.log(
                        "AUTH CALLBACK:",
                        callbackUrl,
                    )

                    const url = new URL(callbackUrl)
                    const code =
                        url.searchParams.get("code")

                    if (!code) {
                        return
                    }

                    if (handledOAuthCodes.has(code)) {
                        return
                    }

                    handledOAuthCodes.add(code)

                    const { data, error } =
                        await supabase.auth.exchangeCodeForSession(
                            code,
                        )

                    if (error) {
                        console.error(
                            "Failed to exchange OAuth code:",
                            error,
                        )
                        return
                    }

                    console.log(
                        "OAuth login successful:",
                        data.session?.user.email,
                    )
                },
            )

        return unsubscribe
    }, [])

    async function signIn(email: string, password: string) {
        return supabase.auth.signInWithPassword({
            email,
            password,
        })
    }

    async function signOut() {
        return supabase.auth.signOut()
    }

    async function signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: "https://auto-media-publisher.vercel.app/auth/desktop-callback",
                skipBrowserRedirect: true,
            },
        })

        if (error) {
            return { error }
        }

        if (!data.url) {
            return {
                error: new Error("Google OAuth URL missing"),
            }
        }

        await window.electronAPI.openExternal(data.url)

        return { error: null }
    }

    return {
        session,
        user: session?.user ?? null as User | null,
        loading,
        signIn,
        signOut,
        signInWithGoogle
    }
}