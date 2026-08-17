import {
    useEffect,
    useRef,
    useState,
} from "react"

import { useAuth } from "./useAuth"

import {
    getOrganizations,
    createOrganization as createOrganizationRequest,
    deleteOrganization as deleteOrganizationRequest,
    getOrganizationMembers,
    updateOrganizationMemberRole,
    removeOrganizationMember,
    leaveOrganization,
    getOrganizationInvitations,
    createOrganizationInvitation,
    revokeOrganizationInvitation,

    type Organization,
    type OrganizationMember,
    type OrganizationRole,
    type OrganizationInvitation,
} from "../api/organizations"

import {
    getOrganizationPresets,
    createOrganizationPreset,
    updateOrganizationPreset,
    deleteOrganizationPreset,

    type OrganizationPreset,
    type CreatePresetInput,
    type UpdatePresetInput,
} from "../api/presets"


export type OrganizationState =
    ReturnType<typeof useOrganization>


export function useOrganization() {
    const auth = useAuth()


    const [organizations, setOrganizations] =
        useState<Organization[]>([])

    const [loadingOrganizations, setLoadingOrganizations] =
        useState(false)

    const [organizationError, setOrganizationError] =
        useState<string | null>(null)


    const [members, setMembers] =
        useState<OrganizationMember[]>([])

    const [loadingMembers, setLoadingMembers] =
        useState(false)

    const [membersError, setMembersError] =
        useState<string | null>(null)


    const [invitations, setInvitations] =
        useState<OrganizationInvitation[]>([])

    const [loadingInvitations, setLoadingInvitations] =
        useState(false)

    const [invitationsError, setInvitationsError] =
        useState<string | null>(null)

    const [presets, setPresets] =
        useState<OrganizationPreset[]>([])

    const [loadingPresets, setLoadingPresets] =
        useState(false)

    const [presetsError, setPresetsError] =
        useState<string | null>(null)


    /*
     * Prevent multiple parts of the UI from refreshing
     * the same workspace simultaneously.
     */
    const workspaceRefreshPromise =
        useRef<Promise<void> | null>(null)

    const lastWorkspaceRefresh =
        useRef(0)


    async function loadOrganizations() {
        if (!auth.session) {
            setOrganizations([])
            return
        }

        setLoadingOrganizations(true)
        setOrganizationError(null)

        try {
            const organizations =
                await getOrganizations(
                    auth.session.access_token,
                )

            setOrganizations(
                organizations,
            )
        } catch (error) {
            setOrganizationError(
                error instanceof Error
                    ? error.message
                    : "Failed to load organizations",
            )
        } finally {
            setLoadingOrganizations(false)
        }
    }

    async function createOrganization(
        name: string,
    ) {
        if (!auth.session) {
            throw new Error("Not signed in")
        }

        const organization =
            await createOrganizationRequest(
                name,
                auth.session.access_token,
            )

        setOrganizations((current) => [
            ...current,
            organization,
        ])

        return organization
    }

    async function loadMembers(
        organizationId: string,
    ) {
        if (!auth.session) {
            setMembers([])
            return
        }

        setLoadingMembers(true)

        try {
            const members =
                await getOrganizationMembers(
                    organizationId,
                    auth.session.access_token,
                )

            setMembers(members)

            // Only clear the previous error
            // after a successful request.
            setMembersError(null)

        } catch (error) {
            setMembersError(
                error instanceof Error
                    ? error.message
                    : "Failed to load organization members",
            )
        } finally {
            setLoadingMembers(false)
        }
    }


    async function loadInvitations(
        organizationId: string,
    ) {
        if (!auth.session) {
            setInvitations([])
            return
        }

        setLoadingInvitations(true)

        try {
            const invitations =
                await getOrganizationInvitations(
                    organizationId,
                    auth.session.access_token,
                )

            setInvitations(
                invitations,
            )

            // Only clear the previous error
            // after a successful request.
            setInvitationsError(null)

        } catch (error) {
            setInvitationsError(
                error instanceof Error
                    ? error.message
                    : "Failed to load invitations",
            )
        } finally {
            setLoadingInvitations(false)
        }
    }


    async function refreshWorkspace(
        organizationId: string,
        options?: {
            force?: boolean
        },
    ) {
        if (!auth.session) {
            return
        }


        /*
         * If another refresh is already running,
         * reuse it instead of sending duplicate requests.
         */
        if (workspaceRefreshPromise.current) {
            return workspaceRefreshPromise.current
        }


        /*
         * Focus can fire several times when switching
         * between Electron, DevTools and other windows.
         *
         * Ignore duplicate automatic refreshes that happen
         * within 1.5 seconds.
         */
        const now = Date.now()

        if (
            !options?.force &&
            now - lastWorkspaceRefresh.current < 1500
        ) {
            return
        }


        lastWorkspaceRefresh.current = now


        const refreshPromise = Promise.all([
            loadMembers(
                organizationId,
            ),

            loadInvitations(
                organizationId,
            ),

            loadPresets(
                organizationId,
            )
        ]).then(() => undefined)


        workspaceRefreshPromise.current =
            refreshPromise


        try {
            await refreshPromise
        } finally {
            workspaceRefreshPromise.current =
                null
        }
    }


    async function updateMemberRole(
        organizationId: string,
        memberUserId: string,
        role: OrganizationRole,
    ) {
        if (!auth.session) {
            throw new Error(
                "Not signed in",
            )
        }

        const updated =
            await updateOrganizationMemberRole(
                organizationId,
                memberUserId,
                role,
                auth.session.access_token,
            )

        setMembers((current) =>
            current.map((member) =>
                member.user_id ===
                    updated.user_id
                    ? updated
                    : member,
            ),
        )
    }


    async function removeMember(
        organizationId: string,
        memberUserId: string,
    ) {
        if (!auth.session) {
            throw new Error(
                "Not signed in",
            )
        }

        await removeOrganizationMember(
            organizationId,
            memberUserId,
            auth.session.access_token,
        )

        setMembers((current) =>
            current.filter(
                (member) =>
                    member.user_id !==
                    memberUserId,
            ),
        )
    }


    async function leave(
        organizationId: string,
    ) {
        if (!auth.session) {
            throw new Error(
                "Not signed in",
            )
        }

        await leaveOrganization(
            organizationId,
            auth.session.access_token,
        )

        await loadOrganizations()
    }


    async function inviteMember(
        organizationId: string,
        email: string,
        role: OrganizationRole,
    ) {
        if (!auth.session) {
            throw new Error(
                "Not signed in",
            )
        }

        const invitation =
            await createOrganizationInvitation(
                organizationId,
                email,
                role,
                auth.session.access_token,
            )

        setInvitations(
            (current) => [
                ...current,
                invitation,
            ],
        )

        return invitation
    }


    async function revokeInvitation(
        organizationId: string,
        invitationId: string,
    ) {
        if (!auth.session) {
            throw new Error(
                "Not signed in",
            )
        }

        await revokeOrganizationInvitation(
            organizationId,
            invitationId,
            auth.session.access_token,
        )

        setInvitations((current) =>
            current.filter(
                (invitation) =>
                    invitation.id !==
                    invitationId,
            ),
        )
    }

    async function loadPresets(
        organizationId: string,
    ) {
        if (!auth.session) {
            setPresets([])
            return
        }

        setLoadingPresets(true)

        try {
            const presets =
                await getOrganizationPresets(
                    organizationId,
                    auth.session.access_token,
                )

            setPresets(presets)
            setPresetsError(null)
        } catch (error) {
            setPresetsError(
                error instanceof Error
                    ? error.message
                    : "Failed to load presets",
            )
        } finally {
            setLoadingPresets(false)
        }
    }


    async function createPreset(
        organizationId: string,
        input: CreatePresetInput,
    ) {
        if (!auth.session) {
            throw new Error("Not signed in")
        }

        const preset =
            await createOrganizationPreset(
                organizationId,
                input,
                auth.session.access_token,
            )

        setPresets((current) => [
            ...current,
            preset,
        ])

        return preset
    }


    async function updatePreset(
        organizationId: string,
        presetId: string,
        input: UpdatePresetInput,
    ) {
        if (!auth.session) {
            throw new Error("Not signed in")
        }

        const updated =
            await updateOrganizationPreset(
                organizationId,
                presetId,
                input,
                auth.session.access_token,
            )

        setPresets((current) =>
            current.map((preset) =>
                preset.id === updated.id
                    ? updated
                    : preset,
            ),
        )

        return updated
    }


    async function deletePreset(
        organizationId: string,
        presetId: string,
    ) {
        if (!auth.session) {
            throw new Error("Not signed in")
        }

        await deleteOrganizationPreset(
            organizationId,
            presetId,
            auth.session.access_token,
        )

        setPresets((current) =>
            current.filter(
                (preset) =>
                    preset.id !== presetId,
            ),
        )
    }

    async function deleteOrganization(
        organizationId: string,
    ) {
        if (!auth.session) {
            throw new Error("Not signed in")
        }

        await deleteOrganizationRequest(
            organizationId,
            auth.session.access_token,
        )

        setOrganizations((current) =>
            current.filter(
                (organization) =>
                    organization.id !== organizationId,
            ),
        )

        setMembers([])
        setInvitations([])
        setPresets([])
    }


    useEffect(() => {
        if (!auth.session) {
            setOrganizations([])
            setMembers([])
            setInvitations([])
            setPresets([])
            return
        }

        void loadOrganizations()

    }, [auth.session?.user.id])


    return {
        ...auth,

        organizations,
        loadingOrganizations,
        organizationError,

        members,
        loadingMembers,
        membersError,

        invitations,
        loadingInvitations,
        invitationsError,

        presets,
        loadingPresets,
        presetsError,

        refreshOrganizations: loadOrganizations,

        createOrganization,
        deleteOrganization,

        loadMembers,
        loadInvitations,
        loadPresets,

        refreshWorkspace,

        updateMemberRole,
        removeMember,
        leaveOrganization: leave,

        inviteMember,
        revokeInvitation,

        createPreset,
        updatePreset,
        deletePreset,
    }
}