import {
    useCallback,
    useEffect,
    useState,
} from "react"

import {
    getOrganizationAuditLogs,
    type OrganizationAuditLog,
} from "@/api/organizations"

import type { OrganizationState } from "./useOrganization"


export function useOrganizationAuditLogs(
    workspace: string,
    organization: OrganizationState,
) {
    const [logs, setLogs] =
        useState<OrganizationAuditLog[]>([])

    const [loading, setLoading] =
        useState(false)

    const [error, setError] =
        useState<string | null>(null)


    const loadAuditLogs = useCallback(
        async () => {
            if (
                workspace === "local" ||
                !organization.session
            ) {
                setLogs([])
                setError(null)
                setLoading(false)
                return
            }

            setLoading(true)
            setError(null)

            try {
                const data =
                    await getOrganizationAuditLogs(
                        workspace,
                        organization.session.access_token,
                    )

                setLogs(data)

            } catch (error) {
                setLogs([])

                setError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load organization activity",
                )

            } finally {
                setLoading(false)
            }
        },
        [
            workspace,
            organization.session?.access_token,
        ],
    )


    useEffect(() => {
        void loadAuditLogs()
    }, [loadAuditLogs])


    function clearAuditLogs() {
        setLogs([])
        setError(null)
        setLoading(false)
    }


    return {
        logs,
        loading,
        error,

        refresh:
            loadAuditLogs,

        clear:
            clearAuditLogs,
    }
}


export type OrganizationAuditLogsState =
    ReturnType<typeof useOrganizationAuditLogs>