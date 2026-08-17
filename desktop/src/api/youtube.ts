import { apiFetch } from "./client"
import type { Playlist } from "@/types/amp"


export type OrganizationYouTubeConnectionResponse = {
    connected: boolean
    organization_id?: string
    channel_id?: string
    channel_name?: string
    channel_handle?: string
    channel_thumbnail?: string
    connected_by?: string
    created_at?: string
    updated_at?: string
}


export type OrganizationYouTubeConnectResponse = {
    authorization_url: string
}

export type OrganizationYouTubeUploadSession = {
    access_token: string
    expires_at: string
    channel_id: string
    channel_name: string
}

export async function getOrganizationYouTubeConnection(
    organizationId: string,
    accessToken: string,
): Promise<OrganizationYouTubeConnectionResponse> {
    const response = await apiFetch(
        `/organizations/${organizationId}/youtube`,
        accessToken,
    )

    if (!response.ok) {
        throw new Error(
            "Failed to load YouTube connection",
        )
    }

    return response.json()
}


export async function connectOrganizationYouTube(
    organizationId: string,
    accessToken: string,
): Promise<OrganizationYouTubeConnectResponse> {
    const response = await apiFetch(
        `/organizations/${organizationId}/youtube/connect`,
        accessToken,
        {
            method: "POST",
        },
    )

    const data =
        await response
            .json()
            .catch(() => null)

    if (!response.ok) {
        throw new Error(
            data?.detail ??
            "Failed to start YouTube connection",
        )
    }

    return data
}


export async function disconnectOrganizationYouTube(
    organizationId: string,
    accessToken: string,
): Promise<void> {
    const response = await apiFetch(
        `/organizations/${organizationId}/youtube`,
        accessToken,
        {
            method: "DELETE",
        },
    )

    if (!response.ok) {
        const data =
            await response
                .json()
                .catch(() => null)

        throw new Error(
            data?.detail ??
            "Failed to disconnect YouTube",
        )
    }
}

export async function getOrganizationYouTubePlaylists(
    organizationId: string,
    accessToken: string,
): Promise<Playlist[]> {
    const response = await apiFetch(
        `/organizations/${organizationId}/youtube/playlists`,
        accessToken,
    )

    if (!response.ok) {
        const data =
            await response
                .json()
                .catch(() => null)

        throw new Error(
            data?.detail ??
            "Failed to load YouTube playlists",
        )
    }

    return response.json()
}

export async function createOrganizationYouTubeUploadSession(
    organizationId: string,
    accessToken: string,
): Promise<OrganizationYouTubeUploadSession> {
    const response = await apiFetch(
        `/organizations/${organizationId}/youtube/upload-session`,
        accessToken,
        {
            method: "POST",
        },
    )

    if (!response.ok) {
        const data =
            await response
                .json()
                .catch(() => null)

        throw new Error(
            data?.detail ??
            "Failed to create YouTube upload session",
        )
    }

    return response.json()
}