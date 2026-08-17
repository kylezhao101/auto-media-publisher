import { apiFetch } from "./client"


export type PresetVisibility =
    | "public"
    | "unlisted"
    | "private"


export type OrganizationPreset = {
    id: string
    organization_id: string
    name: string
    title_template: string | null
    description_template: string | null
    visibility: PresetVisibility
    created_at: string
    updated_at: string
}


export type CreatePresetInput = {
    name: string
    title_template?: string | null
    description_template?: string | null
    visibility: PresetVisibility
}


export type UpdatePresetInput = {
    name?: string
    title_template?: string | null
    description_template?: string | null
    visibility?: PresetVisibility
}


async function getErrorMessage(
    response: Response,
    fallback: string,
) {
    const data = await response
        .json()
        .catch(() => null)

    return data?.detail ?? fallback
}


export async function getOrganizationPresets(
    organizationId: string,
    accessToken: string,
): Promise<OrganizationPreset[]> {
    const response = await apiFetch(
        `/organizations/${organizationId}/presets`,
        accessToken,
    )

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "Failed to load presets",
            ),
        )
    }

    return response.json()
}


export async function getOrganizationPreset(
    organizationId: string,
    presetId: string,
    accessToken: string,
): Promise<OrganizationPreset> {
    const response = await apiFetch(
        `/organizations/${organizationId}/presets/${presetId}`,
        accessToken,
    )

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "Failed to load preset",
            ),
        )
    }

    return response.json()
}


export async function createOrganizationPreset(
    organizationId: string,
    input: CreatePresetInput,
    accessToken: string,
): Promise<OrganizationPreset> {
    const response = await apiFetch(
        `/organizations/${organizationId}/presets`,
        accessToken,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json",
            },

            body: JSON.stringify(input),
        },
    )

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "Failed to create preset",
            ),
        )
    }

    return response.json()
}


export async function updateOrganizationPreset(
    organizationId: string,
    presetId: string,
    input: UpdatePresetInput,
    accessToken: string,
): Promise<OrganizationPreset> {
    const response = await apiFetch(
        `/organizations/${organizationId}/presets/${presetId}`,
        accessToken,
        {
            method: "PATCH",

            headers: {
                "Content-Type":
                    "application/json",
            },

            body: JSON.stringify(input),
        },
    )

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "Failed to update preset",
            ),
        )
    }

    return response.json()
}


export async function deleteOrganizationPreset(
    organizationId: string,
    presetId: string,
    accessToken: string,
): Promise<void> {
    const response = await apiFetch(
        `/organizations/${organizationId}/presets/${presetId}`,
        accessToken,
        {
            method: "DELETE",
        },
    )

    if (!response.ok) {
        throw new Error(
            await getErrorMessage(
                response,
                "Failed to delete preset",
            ),
        )
    }
}