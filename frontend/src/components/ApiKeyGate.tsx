import { useState } from "react"
import { setApiKey } from "@/store/apiKeyStore"
import { validateApiKey } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface Props {
    onAuthenticated: () => void
}

export function ApiKeyGate({ onAuthenticated }: Props) {
    const [key, setKey] = useState("")
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    async function handleSubmit() {
        if (!key.trim()) return
        setIsLoading(true)
        setError("")

        setApiKey(key.trim())

        try {
            await validateApiKey()
        } catch (err: any) {
            setError(err.response?.data?.detail || "Invalid API key")
            setIsLoading(false)
            return
        }

        setIsLoading(false)
        onAuthenticated()
    }

    return (
        <main className="min-h-svh bg-background flex items-center justify-center p-6">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Auto Media Publisher</CardTitle>
                    <CardDescription>Enter your API key to continue.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <Input
                        type="password"
                        placeholder="API key"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button onClick={handleSubmit} disabled={isLoading || !key.trim()}>
                        {isLoading ? "Verifying..." : "Unlock"}
                    </Button>
                </CardContent>
            </Card>
        </main>
    )
}