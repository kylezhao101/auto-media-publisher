import {
    useEffect,
    useState,
} from "react"

import { Trash2 } from "lucide-react"

import type { OrganizationState } from "@/hooks/useOrganization"
import type {
    Organization,
    OrganizationRole,
} from "@/api/organizations"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"


type Props = {
    organization: OrganizationState
    selectedOrganization: Organization
    currentUserRole?: OrganizationRole
}


export function OrganizationDangerZone({
    organization,
    selectedOrganization,
    currentUserRole,
}: Props) {
    const [open, setOpen] =
        useState(false)

    const [confirmation, setConfirmation] =
        useState("")

    const [deleting, setDeleting] =
        useState(false)

    const [error, setError] =
        useState<string | null>(null)


    const isOwner =
        currentUserRole === "owner"


    const confirmed =
        confirmation ===
        selectedOrganization.name


    useEffect(() => {
        if (!open) {
            return
        }

        setConfirmation("")
        setError(null)
    }, [open])


    if (!isOwner) {
        return null
    }


    async function handleDelete() {
        if (!confirmed) {
            return
        }

        setDeleting(true)
        setError(null)

        try {
            await organization.deleteOrganization(
                selectedOrganization.id,
            )

            setOpen(false)

        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Failed to delete organization",
            )

        } finally {
            setDeleting(false)
        }
    }


    return (
        <>
            <Card className="border-destructive/30">
                <CardHeader>
                    <CardTitle>
                        Danger zone
                    </CardTitle>

                    <CardDescription>
                        Irreversible organization actions.
                    </CardDescription>
                </CardHeader>


                <CardContent>
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 p-4">

                        <div>
                            <p className="text-sm font-medium">
                                Delete organization
                            </p>

                            <p className="mt-1 text-sm text-muted-foreground">
                                Permanently delete this
                                organization and all of its
                                associated data.
                            </p>
                        </div>


                        <Button
                            variant="destructive"
                            onClick={() =>
                                setOpen(true)
                            }
                        >
                            <Trash2 className="size-4" />
                            Delete organization
                        </Button>

                    </div>
                </CardContent>
            </Card>


            <Dialog
                open={open}
                onOpenChange={setOpen}
            >
                <DialogContent className="sm:max-w-md">

                    <DialogHeader>
                        <DialogTitle>
                            Delete{" "}
                            {selectedOrganization.name}?
                        </DialogTitle>

                        <DialogDescription>
                            This permanently deletes the
                            organization, its members,
                            invitations, presets, and
                            YouTube connection. This action
                            cannot be undone.
                        </DialogDescription>
                    </DialogHeader>


                    <div className="grid gap-2 py-2">

                        <label
                            htmlFor="delete-organization-confirmation"
                            className="text-sm font-medium"
                        >
                            Type{" "}
                            <span className="font-semibold">
                                {selectedOrganization.name}
                            </span>{" "}
                            to confirm
                        </label>


                        <Input
                            id="delete-organization-confirmation"
                            value={confirmation}
                            disabled={deleting}
                            onChange={(event) =>
                                setConfirmation(
                                    event.target.value,
                                )
                            }
                            autoComplete="off"
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
                            disabled={deleting}
                            onClick={() =>
                                setOpen(false)
                            }
                        >
                            Cancel
                        </Button>

                        <Button
                            variant="destructive"
                            disabled={
                                deleting ||
                                !confirmed
                            }
                            onClick={
                                handleDelete
                            }
                        >
                            {deleting
                                ? "Deleting..."
                                : "Delete organization"}
                        </Button>
                    </DialogFooter>

                </DialogContent>
            </Dialog>
        </>
    )
}