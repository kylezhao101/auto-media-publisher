import { useEffect } from "react"

import { Button } from "@/components/ui/button"

export function DesktopAuthCallback() {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")

    const openDesktopApp = () => {
        if (!code) return

        window.location.href =
            `amp://auth/callback?code=${encodeURIComponent(code)}`
    }

    useEffect(() => {
        if (!code) return

        openDesktopApp()
    }, [code])

    if (!code) {
        return (
            <main className="flex min-h-svh items-center justify-center p-6">
                <div className="text-center">
                    <h1 className="text-2xl font-semibold">
                        Sign-in failed
                    </h1>

                    <p className="mt-2 text-sm text-muted-foreground">
                        The authentication code is missing.
                    </p>
                </div>
            </main>
        )
    }

    return (
        <main className="flex min-h-svh items-center justify-center p-6">
            <div className="w-full max-w-sm text-center">
                <h1 className="text-2xl font-semibold">
                    Sign-in complete
                </h1>

                <p className="mt-2 text-sm text-muted-foreground">
                    Auto Media Publisher should open automatically.
                    You can close this window once you're back in the app.
                </p>

                <Button
                    className="mt-6"
                    onClick={openDesktopApp}
                >
                    Open Auto Media Publisher
                </Button>
            </div>
        </main>
    )
}