import { useEffect, useRef, useState, type SetStateAction } from "react";
import type { Playlist, PlaylistOption } from "../types/amp";

type UsePlaylistsArgs = {
  enabled: boolean;
  sourceKey: string;
  fetchPlaylists: () => Promise<Playlist[]>;
};

export function usePlaylists({
  enabled,
  sourceKey,
  fetchPlaylists,
}: UsePlaylistsArgs) {
  const [state, setState] = useState({
    sourceKey,
    enabled,
    playlists: [] as Playlist[],
    loading: false,
    error: null as string | null,
  });
  const [selection, setSelection] = useState({
    sourceKey,
    ids: [] as string[],
  });
  const requestId = useRef(0);
  const current = useRef({ sourceKey, enabled });
  current.current = { sourceKey, enabled };

  async function loadPlaylists() {
    if (
      !enabled ||
      current.current.sourceKey !== sourceKey ||
      !current.current.enabled
    )
      return;
    const id = ++requestId.current;
    const isCurrent = () =>
      id === requestId.current &&
      current.current.sourceKey === sourceKey &&
      current.current.enabled;
    setState((previous) => ({
      sourceKey,
      enabled,
      playlists: previous.sourceKey === sourceKey ? previous.playlists : [],
      loading: true,
      error: null,
    }));
    try {
      const playlists = await fetchPlaylists();
      if (isCurrent())
        setState({
          sourceKey,
          enabled,
          playlists,
          loading: false,
          error: null,
        });
    } catch (error) {
      if (isCurrent())
        setState((previous) => ({
          ...previous,
          loading: false,
          error: `Failed to load playlists: ${error instanceof Error ? error.message : String(error)}`,
        }));
    }
  }

  useEffect(() => {
    setSelection({ sourceKey, ids: [] });
    setState({
      sourceKey,
      enabled,
      playlists: [],
      loading: false,
      error: null,
    });
    if (enabled) void loadPlaylists();
    return () => {
      requestId.current++;
    };
  }, [enabled, sourceKey]);

  const matchesSource =
    state.sourceKey === sourceKey && state.enabled === enabled;
  const playlists = matchesSource && enabled ? state.playlists : [];
  const playlistOptions: PlaylistOption[] = playlists.map((playlist) => ({
    value: playlist.id,
    label: playlist.title,
  }));

  function setSelectedPlaylistIds(value: SetStateAction<string[]>) {
    if (current.current.sourceKey !== sourceKey) return;
    setSelection((previous) => ({
      sourceKey,
      ids:
        typeof value === "function"
          ? value(previous.sourceKey === sourceKey ? previous.ids : [])
          : value,
    }));
  }

  return {
    playlists,
    playlistOptions,
    selectedPlaylistIds:
      selection.sourceKey === sourceKey && enabled ? selection.ids : [],
    setSelectedPlaylistIds,
    isLoadingPlaylists: matchesSource && enabled && state.loading,
    playlistError: matchesSource && enabled ? state.error : null,
    loadPlaylists,
  };
}
