import { apiFetch } from "./client"

export type Organization = {
    id: string
    name: string
    created_at: string
}

export type OrganizationRole =
    | "owner"
    | "admin"
    | "publisher"
    | "member"

export type OrganizationInviteRole =
    | "admin"
    | "publisher"
    | "member"

export type OrganizationMember = {
    user_id: string
    email: string
    display_name?: string
    avatar_url?: string
    role: OrganizationRole
    created_at: string
}

export type OrganizationInvitation = {
    id: string
    organization_id: string
    email: string
    role: OrganizationRole
    invited_by: string
    token: string
    created_at: string
    expires_at: string
    accepted_at: string | null
}

export async function getOrganizations(
    accessToken: string,
): Promise<Organization[]> {
    const response = await apiFetch(
        "/organizations",
        accessToken,
    )

    if (!response.ok) {
        throw new Error("Failed to load organizations")
    }

    return response.json()
}

export async function createOrganization(
    name: string,
    accessToken: string,
): Promise<Organization> {
    const response = await apiFetch(
        "/organizations",
        accessToken,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name,
            }),
        },
    )

    if (!response.ok) {
        const data =
            await response
                .json()
                .catch(() => null)

        throw new Error(
            data?.detail ??
            "Failed to create organization",
        )
    }

    return response.json()
}

export async function getOrganizationMembers(
    organizationId: string,
    accessToken: string,
): Promise<OrganizationMember[]> {
    const response = await apiFetch(
        `/organizations/${organizationId}/members`,
        accessToken,
    )

    if (!response.ok) {
        throw new Error("Failed to load organization members")
    }

    return response.json()
}

export async function updateOrganizationMemberRole(
    organizationId: string,
    memberUserId: string,
    role: OrganizationRole,
    accessToken: string,
): Promise<OrganizationMember> {
    const response = await apiFetch(
        `/organizations/${organizationId}/members/${memberUserId}`,
        accessToken,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                role,
            }),
        },
    )

    if (!response.ok) {
        throw new Error("Failed to update member role")
    }

    return response.json()
}

export async function removeOrganizationMember(
    organizationId: string,
    memberUserId: string,
    accessToken: string,
): Promise<void> {
    const response = await apiFetch(
        `/organizations/${organizationId}/members/${memberUserId}`,
        accessToken,
        {
            method: "DELETE",
        },
    )

    if (!response.ok) {
        throw new Error("Failed to remove organization member")
    }
}

export async function leaveOrganization(
    organizationId: string,
    accessToken: string,
): Promise<void> {
    const response = await apiFetch(
        `/organizations/${organizationId}/members/me`,
        accessToken,
        {
            method: "DELETE",
        },
    )

    if (!response.ok) {
        throw new Error("Failed to leave organization")
    }
}


export async function getOrganizationInvitations(
    organizationId: string,
    accessToken: string,
): Promise<OrganizationInvitation[]> {
    const response = await apiFetch(
        `/organizations/${organizationId}/invitations`,
        accessToken,
    )

    if (!response.ok) {
        throw new Error("Failed to load invitations")
    }

    return response.json()
}

export async function createOrganizationInvitation(
    organizationId: string,
    email: string,
    role: OrganizationRole,
    accessToken: string,
): Promise<OrganizationInvitation> {
    const response = await apiFetch(
        `/organizations/${organizationId}/invitations`,
        accessToken,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email,
                role,
            }),
        },
    )

    if (!response.ok) {
        const data = await response.json().catch(() => null)

        throw new Error(
            data?.detail ?? "Failed to send invitation",
        )
    }

    return response.json()
}

export async function revokeOrganizationInvitation(
    organizationId: string,
    invitationId: string,
    accessToken: string,
): Promise<void> {
    const response = await apiFetch(
        `/organizations/${organizationId}/invitations/${invitationId}`,
        accessToken,
        {
            method: "DELETE",
        },
    )

    if (!response.ok) {
        throw new Error("Failed to revoke invitation")
    }
}

export async function deleteOrganization(
    organizationId: string,
    accessToken: string,
): Promise<void> {
    const response = await apiFetch(
        `/organizations/${organizationId}`,
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
            "Failed to delete organization",
        )
    }
}