import {
    useEffect,
    useState,
} from "react"

import type {
    JobProgress,
    Playlist,
    PlaylistOption,
} from "../types/amp"


type UsePlaylistsArgs = {
    enabled: boolean
    sourceKey: string

    fetchPlaylists: () =>
        Promise<Playlist[]>

    setProgress: (
        progress: JobProgress,
    ) => void
}


export function usePlaylists({
    enabled,
    sourceKey,
    fetchPlaylists,
    setProgress,
}: UsePlaylistsArgs) {
    const [playlists, setPlaylists] =
        useState<Playlist[]>([])

    const [
        selectedPlaylistIds,
        setSelectedPlaylistIds,
    ] = useState<string[]>([])

    const [
        isLoadingPlaylists,
        setIsLoadingPlaylists,
    ] = useState(false)


    const playlistOptions:
        PlaylistOption[] =
        playlists.map(
            (playlist) => ({
                value:
                    playlist.id,

                label:
                    playlist.title,
            }),
        )


    async function loadPlaylists() {
        if (!enabled) {
            return
        }

        setIsLoadingPlaylists(
            true,
        )

        try {
            const result =
                await fetchPlaylists()

            setPlaylists(
                result,
            )

        } catch (error) {
            setProgress({
                stage: "warning",

                message:
                    `Failed to load playlists: ${String(error)}`,
            })

        } finally {
            setIsLoadingPlaylists(
                false,
            )
        }
    }


    useEffect(() => {
        /*
         * Never carry playlist selections
         * between YouTube channels.
         */
        setSelectedPlaylistIds([])

        if (!enabled) {
            setPlaylists([])
            return
        }

        void loadPlaylists()

    }, [
        enabled,
        sourceKey,
    ])


    return {
        playlists,
        playlistOptions,

        selectedPlaylistIds,
        setSelectedPlaylistIds,

        isLoadingPlaylists,
        loadPlaylists,
    }
}