import { useEffect, useState } from "react";

import type { OrganizationState } from "./useOrganization";

import { getOrganizationYouTubeConnection } from "@/api/youtube";

export type YouTubeConnectionInfo = {
    connected: boolean;
    channelId?: string;
    channelName?: string;
    channelHandle?: string;
    channelThumbnail?: string;
};

export function useYouTubeConnection(
    workspace: string,
    organization: OrganizationState,
    localConnection: YouTubeConnectionInfo
) {
    const [connection, setConnection] = useState<YouTubeConnectionInfo>({
        connected: false,
    });

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState<string | null>(null);

    function clearConnection() {
        setConnection({
            connected: false,
        });

        setError(null);
    }

    async function loadLocalConnection() {
        /*
         * No local token exists, so there is
         * nothing to query.
         */
        if (!localConnection.connected) {
            clearConnection();
            return;
        }

        const channel = await window.electronAPI.getYouTubeChannel();

        setConnection({
            connected: true,

            channelId: channel.channel_id,

            channelName: channel.channel_name,

            channelHandle: channel.channel_handle,

            channelThumbnail: channel.channel_thumbnail,
        });
    }

    async function loadOrganizationConnection() {
        if (!organization.session) {
            clearConnection();
            return;
        }

        const data = await getOrganizationYouTubeConnection(
            workspace,
            organization.session.access_token
        );

        if (!data.connected) {
            clearConnection();
            return;
        }

        setConnection({
            connected: true,

            channelId: data.channel_id,

            channelName: data.channel_name,

            channelHandle: data.channel_handle,

            channelThumbnail: data.channel_thumbnail,
        });
    }

    async function loadConnection() {
        setLoading(true);
        setError(null);

        try {
            if (workspace === "local") {
                await loadLocalConnection();
            } else {
                await loadOrganizationConnection();
            }
        } catch (error) {
            /*
             * Don't leave a partial/stale connection
             * visible when refreshing fails.
             */
            setConnection({
                connected: false,
            });

            setError(
                error instanceof Error
                    ? error.message
                    : "Failed to load YouTube connection"
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadConnection();
    }, [
        workspace,
        organization.session?.user.id,

        /*
         * For Personal we only care about whether
         * a local token exists. Channel metadata is
         * now loaded by this hook itself.
         */
        localConnection.connected,
    ]);

    return {
        connection,
        loading,
        error,

        refresh: loadConnection,

        clear: clearConnection,
    };
}

export type YouTubeConnectionState = ReturnType<typeof useYouTubeConnection>;
