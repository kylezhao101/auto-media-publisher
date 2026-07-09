import { useEffect, useState } from "react";
import type { AuthStatus, Playlist, PlaylistOption } from "../types/amp";
import type { JobProgress } from "../types/amp";

type UsePlaylistsArgs = {
    authStatus: AuthStatus;
    setProgress: (progress: JobProgress) => void;
};

export function usePlaylists({ authStatus, setProgress }: UsePlaylistsArgs) {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
    const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);

    const playlistOptions: PlaylistOption[] = playlists.map((playlist) => ({
        value: playlist.id,
        label: playlist.title,
    }));

    const loadPlaylists = async () => {
        if (!authStatus.token) return;

        setIsLoadingPlaylists(true);

        try {
            const result = await window.electronAPI.listPlaylists();
            setPlaylists(result);
        } catch (err) {
            setProgress({
                stage: "warning",
                message: `Failed to load playlists: ${String(err)}`,
            });
        } finally {
            setIsLoadingPlaylists(false);
        }
    };

    useEffect(() => {
        if (authStatus.token) {
            loadPlaylists();
        } else {
            setPlaylists([]);
            setSelectedPlaylistIds([]);
        }
    }, [authStatus.token]);

    return {
        playlists,
        playlistOptions,
        selectedPlaylistIds,
        setSelectedPlaylistIds,
        isLoadingPlaylists,
        loadPlaylists,
    };
}