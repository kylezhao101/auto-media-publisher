import { useEffect } from "react"

export function DesktopAuthCallback() {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")

    useEffect(() => {
        if (!code) {
            return
        }

        const callbackUrl =
            `amp://auth/callback?code=${encodeURIComponent(code)}`

        window.location.href = callbackUrl
    }, [code])

    if (!code) {
        return (
            <main className="flex min-h-svh items-center justify-center bg-background p-6">
                <div className="w-full max-w-sm text-center">
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

    const openDesktopApp = () => {
        window.location.href =
            `amp://auth/callback?code=${encodeURIComponent(code)}`
    }

    return (
        <main className="flex min-h-svh items-center justify-center bg-background p-6">
            <div className="w-full max-w-sm text-center">
                <h1 className="text-2xl font-semibold">
                    Sign-in complete
                </h1>

                <p className="mt-2 text-sm text-muted-foreground">
                    Auto Media Publisher should open automatically.
                    You can close this window once you're back in the app.
                </p>

                <button
                    className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    onClick={openDesktopApp}
                >
                    Open Auto Media Publisher
                </button>
            </div>
        </main>
    )
}