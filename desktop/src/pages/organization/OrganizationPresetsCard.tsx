import {
    MoreHorizontal,
    Plus,
    RefreshCw,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { OrganizationState } from "@/hooks/useOrganization"
import type { OrganizationRole } from "@/api/organizations"
import { useState } from "react"
import type { OrganizationPreset } from "@/api/presets"
import { PresetDialog } from "./PresetDialog"


type Props = {
    workspace: string
    organization: OrganizationState
    currentUserRole?: OrganizationRole
}


export function OrganizationPresetsCard({
    workspace,
    organization,
    currentUserRole,
}: Props) {
    const [dialogOpen, setDialogOpen] =
        useState(false)

    const [editingPreset, setEditingPreset] =
        useState<OrganizationPreset | null>(null)

    const {
        presets,
        loadingPresets,
        presetsError,
        loadPresets,
        deletePreset,
    } = organization


    const canManage =
        currentUserRole === "owner" ||
        currentUserRole === "admin"


    async function handleDelete(
        presetId: string,
    ) {
        try {
            await deletePreset(
                workspace,
                presetId,
            )
        } catch (error) {
            console.error(
                "Failed to delete preset:",
                error,
            )
        }
    }


    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <CardTitle>
                                Presets
                            </CardTitle>

                            <CardDescription>
                                Reusable publishing settings
                                for this organization.
                            </CardDescription>
                        </div>

                        <div className="flex items-center gap-2">
                            <Badge variant="outline">
                                {presets.length}{" "}
                                {presets.length === 1
                                    ? "preset"
                                    : "presets"}
                            </Badge>

                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                    loadPresets(
                                        workspace,
                                    )
                                }
                                disabled={
                                    loadingPresets
                                }
                                title="Refresh presets"
                                aria-label="Refresh presets"
                            >
                                <RefreshCw
                                    className={`size-4 ${loadingPresets
                                        ? "animate-spin"
                                        : ""
                                        }`}
                                />
                            </Button>

                            {canManage && (
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        setEditingPreset(null)
                                        setDialogOpen(true)
                                    }}
                                >
                                    <Plus className="size-4" />
                                    Create preset
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>


                <CardContent>
                    {presetsError ? (
                        <p className="text-sm text-destructive">
                            {presetsError}
                        </p>
                    ) : loadingPresets &&
                        presets.length === 0 ? (
                        <div className="flex h-32 items-center justify-center">
                            <p className="text-sm text-muted-foreground">
                                Loading presets...
                            </p>
                        </div>
                    ) : presets.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-8 text-center">
                            <p className="text-sm font-medium">
                                No presets yet
                            </p>

                            <p className="mt-1 text-sm text-muted-foreground">
                                Create a preset to reuse
                                publishing settings.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {presets.map(
                                (preset) => (
                                    <div
                                        key={preset.id}
                                        className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate text-sm font-medium">
                                                    {
                                                        preset.name
                                                    }
                                                </p>

                                                <Badge
                                                    variant="outline"
                                                    className="capitalize"
                                                >
                                                    {
                                                        preset.visibility
                                                    }
                                                </Badge>
                                            </div>

                                            {preset.title_template && (
                                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                                    {
                                                        preset.title_template
                                                    }
                                                </p>
                                            )}
                                        </div>

                                        {canManage && (
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
                                                        onClick={() => {
                                                            setEditingPreset(preset)
                                                            setDialogOpen(true)
                                                        }}
                                                    >
                                                        Edit preset
                                                    </DropdownMenuItem>

                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onClick={() =>
                                                            handleDelete(
                                                                preset.id,
                                                            )
                                                        }
                                                    >
                                                        Delete preset
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                ),
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <PresetDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                workspace={workspace}
                organization={organization}
                preset={editingPreset}
            />
        </>
    )
}