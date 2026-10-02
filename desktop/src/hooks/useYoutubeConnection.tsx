import { useEffect, useRef, useState } from "react";
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
  const sourceKey = JSON.stringify([
    workspace,
    workspace === "local"
      ? localConnection.connected
      : organization.session?.user.id,
  ]);
  const [state, setState] = useState({
    sourceKey,
    connection: { connected: false } as YouTubeConnectionInfo,
    loading: false,
    error: null as string | null,
  });
  const requestId = useRef(0);
  const currentSource = useRef(sourceKey);
  currentSource.current = sourceKey;

  function clearConnection() {
    if (currentSource.current !== sourceKey) return;
    requestId.current++;
    setState({
      sourceKey,
      connection: { connected: false },
      loading: false,
      error: null,
    });
  }

  async function loadConnection() {
    if (currentSource.current !== sourceKey) return;
    const id = ++requestId.current;
    const isCurrent = () =>
      id === requestId.current && currentSource.current === sourceKey;
    setState((previous) => ({
      sourceKey,
      connection:
        previous.sourceKey === sourceKey
          ? previous.connection
          : { connected: false },
      loading: true,
      error: null,
    }));
    try {
      let connection: YouTubeConnectionInfo = { connected: false };
      if (workspace === "local" && localConnection.connected) {
        const channel = await window.electronAPI.getYouTubeChannel();
        connection = {
          connected: true,
          channelId: channel.channel_id,
          channelName: channel.channel_name,
          channelHandle: channel.channel_handle,
          channelThumbnail: channel.channel_thumbnail,
        };
      } else if (workspace !== "local" && organization.session) {
        const data = await getOrganizationYouTubeConnection(
          workspace,
          organization.session.access_token
        );
        if (data.connected)
          connection = {
            connected: true,
            channelId: data.channel_id,
            channelName: data.channel_name,
            channelHandle: data.channel_handle,
            channelThumbnail: data.channel_thumbnail,
          };
      }
      if (isCurrent())
        setState({ sourceKey, connection, loading: false, error: null });
    } catch (error) {
      if (isCurrent())
        setState({
          sourceKey,
          connection: { connected: false },
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load YouTube connection",
        });
    }
  }

  useEffect(() => {
    void loadConnection();
    return () => {
      requestId.current++;
    };
  }, [sourceKey]);

  const matchesSource = state.sourceKey === sourceKey;
  return {
    connection: matchesSource ? state.connection : { connected: false },
    loading: !matchesSource || state.loading,
    error: matchesSource ? state.error : null,
    refresh: loadConnection,
    clear: clearConnection,
  };
}

export type YouTubeConnectionState = ReturnType<typeof useYouTubeConnection>;
