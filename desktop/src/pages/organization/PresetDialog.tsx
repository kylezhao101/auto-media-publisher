import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import type {
    CreatePresetInput,
    OrganizationPreset,
    PresetVisibility,
    UpdatePresetInput,
} from "@/api/presets"

import type { OrganizationState } from "@/hooks/useOrganization"


type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void

    workspace: string
    organization: OrganizationState

    preset?: OrganizationPreset | null
}


export function PresetDialog({
    open,
    onOpenChange,
    workspace,
    organization,
    preset,
}: Props) {
    const [name, setName] =
        useState("")

    const [titleTemplate, setTitleTemplate] =
        useState("")

    const [
        descriptionTemplate,
        setDescriptionTemplate,
    ] = useState("")

    const [visibility, setVisibility] =
        useState<PresetVisibility>("public")

    const [saving, setSaving] =
        useState(false)

    const [error, setError] =
        useState<string | null>(null)


    const editing =
        Boolean(preset)


    useEffect(() => {
        if (!open) {
            return
        }

        if (preset) {
            setName(
                preset.name,
            )

            setTitleTemplate(
                preset.title_template ?? "",
            )

            setDescriptionTemplate(
                preset.description_template ?? "",
            )

            setVisibility(
                preset.visibility,
            )
        } else {
            setName("")
            setTitleTemplate("")
            setDescriptionTemplate("")
            setVisibility("public")
        }

        setError(null)

    }, [
        open,
        preset,
    ])


    async function handleSave() {
        const normalizedName =
            name.trim()

        if (!normalizedName) {
            setError(
                "Enter a preset name.",
            )
            return
        }


        setSaving(true)
        setError(null)


        try {
            if (preset) {
                const input: UpdatePresetInput = {
                    name:
                        normalizedName,

                    title_template:
                        titleTemplate.trim() ||
                        null,

                    description_template:
                        descriptionTemplate.trim() ||
                        null,

                    visibility,
                }


                await organization.updatePreset(
                    workspace,
                    preset.id,
                    input,
                )
            } else {
                const input: CreatePresetInput = {
                    name:
                        normalizedName,

                    title_template:
                        titleTemplate.trim() ||
                        null,

                    description_template:
                        descriptionTemplate.trim() ||
                        null,

                    visibility,
                }


                await organization.createPreset(
                    workspace,
                    input,
                )
            }


            onOpenChange(false)

        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : editing
                        ? "Failed to update preset"
                        : "Failed to create preset",
            )
        } finally {
            setSaving(false)
        }
    }


    return (
        <Dialog
            open={open}
            onOpenChange={
                onOpenChange
            }
        >
            <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">

                <DialogHeader>
                    <DialogTitle>
                        {editing
                            ? "Edit preset"
                            : "Create preset"}
                    </DialogTitle>

                    <DialogDescription>
                        {editing
                            ? "Update the publishing settings for this preset."
                            : "Create reusable publishing settings for this organization."}
                    </DialogDescription>
                </DialogHeader>


                <div className="grid gap-5 py-2">

                    <div className="grid gap-2">
                        <label
                            htmlFor="preset-name"
                            className="text-sm font-medium"
                        >
                            Name
                        </label>

                        <Input
                            id="preset-name"
                            placeholder="Title"
                            value={name}
                            onChange={(event) =>
                                setName(
                                    event.target.value,
                                )
                            }
                        />
                    </div>


                    <div className="grid gap-2">
                        <label
                            htmlFor="preset-title-template"
                            className="text-sm font-medium"
                        >
                            Title template
                        </label>

                        <Input
                            id="preset-title-template"
                            placeholder="Title"
                            value={
                                titleTemplate
                            }
                            onChange={(event) =>
                                setTitleTemplate(
                                    event.target.value,
                                )
                            }
                        />

                        <p className="text-xs text-muted-foreground">
                            Used to prefill the video title
                            when this preset is selected.
                        </p>
                    </div>


                    <div className="grid gap-2">
                        <label
                            htmlFor="preset-description-template"
                            className="text-sm font-medium"
                        >
                            Description template
                        </label>

                        <Textarea
                            id="preset-description-template"
                            placeholder="Some description here..."
                            value={
                                descriptionTemplate
                            }
                            onChange={(event) =>
                                setDescriptionTemplate(
                                    event.target.value,
                                )
                            }
                            className="min-h-32 resize-y"
                        />

                        <p className="text-xs text-muted-foreground">
                            Used to prefill the video
                            description.
                        </p>
                    </div>


                    <div className="grid gap-2">
                        <label className="text-sm font-medium">
                            Visibility
                        </label>

                        <Select
                            value={
                                visibility
                            }
                            onValueChange={(
                                value,
                            ) =>
                                setVisibility(
                                    value as PresetVisibility,
                                )
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>

                            <SelectContent
                                alignItemWithTrigger={
                                    false
                                }
                                side="bottom"
                                align="start"
                                sideOffset={4}
                                className="rounded-md border-border"
                            >
                                <SelectItem value="public">
                                    Public
                                </SelectItem>

                                <SelectItem value="unlisted">
                                    Unlisted
                                </SelectItem>

                                <SelectItem value="private">
                                    Private
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>


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
                        disabled={saving}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={
                            handleSave
                        }
                        disabled={
                            saving ||
                            !name.trim()
                        }
                    >
                        {saving
                            ? editing
                                ? "Saving..."
                                : "Creating..."
                            : editing
                                ? "Save changes"
                                : "Create preset"}
                    </Button>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    )
}