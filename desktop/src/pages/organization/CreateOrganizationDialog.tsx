import {
    useEffect,
    useState,
} from "react"

import { Building2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

import type { OrganizationState } from "@/hooks/useOrganization"


type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void

    organization: OrganizationState

    onCreated: (
        organizationId: string,
    ) => void
}


export function CreateOrganizationDialog({
    open,
    onOpenChange,
    organization,
    onCreated,
}: Props) {
    const [name, setName] =
        useState("")

    const [creating, setCreating] =
        useState(false)

    const [error, setError] =
        useState<string | null>(null)


    useEffect(() => {
        if (!open) {
            return
        }

        setName("")
        setError(null)
    }, [open])


    async function handleCreate() {
        const normalizedName =
            name.trim()

        if (!normalizedName) {
            setError(
                "Enter an organization name.",
            )

            return
        }


        setCreating(true)
        setError(null)


        try {
            const created =
                await organization.createOrganization(
                    normalizedName,
                )

            onOpenChange(false)

            onCreated(
                created.id,
            )
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Failed to create organization",
            )
        } finally {
            setCreating(false)
        }
    }


    return (
        <Dialog
            open={open}
            onOpenChange={
                onOpenChange
            }
        >
            <DialogContent className="sm:max-w-md">

                <DialogHeader>
                    <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
                        <Building2 className="size-5 text-muted-foreground" />
                    </div>

                    <DialogTitle>
                        Create organization
                    </DialogTitle>

                    <DialogDescription>
                        Create a shared publishing
                        workspace for your team.
                    </DialogDescription>
                </DialogHeader>


                <div className="grid gap-2 py-2">
                    <label
                        htmlFor="organization-name"
                        className="text-sm font-medium"
                    >
                        Organization name
                    </label>

                    <Input
                        id="organization-name"
                        placeholder="My organization"
                        value={name}
                        autoFocus
                        onChange={(event) =>
                            setName(
                                event.target.value,
                            )
                        }
                        onKeyDown={(event) => {
                            if (
                                event.key ===
                                "Enter"
                            ) {
                                void handleCreate()
                            }
                        }}
                    />

                    {error && (
                        <p className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
                </div>


                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() =>
                            onOpenChange(false)
                        }
                        disabled={creating}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={
                            handleCreate
                        }
                        disabled={
                            creating ||
                            !name.trim()
                        }
                    >
                        {creating
                            ? "Creating..."
                            : "Create organization"}
                    </Button>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    )
}