/// <reference types="vite/client" />

export { };

export type JobProgress = {
    stage: "rendering" | "uploading" | "done" | "warning";
    percent?: number;
    video_id?: string;
    message?: string;
    outputPath?: string;
};

export type Thumbnail = {
    path: string;
    preview: string;
};

export type RenderedVideo = {
    name: string;
    path: string;
    size: number;
    modifiedAt: string;
};

export type Encoder = "cpu" | "gpu";
export type PerformanceMode = "fast" | "balanced" | "low";
export type Visibility = "private" | "unlisted" | "public"

export type YouTubeAuth =
    | {
        type: "local"
    }
    | {
        type: "access_token"
        access_token: string
    }

type StartJobPayload = {
    mode?: "render-and-upload" | "upload-existing"
    clips: string[]
    thumbnail: Thumbnail | null
    title: string
    description: string
    output_path?: string
    encoder: Encoder
    performance_mode: PerformanceMode
    visibility: Visibility
    playlist_ids: string[]

    youtube_auth: YouTubeAuth
}

declare global {
    interface Window {
        electronAPI: {
            getAppVersion: () => Promise<string>;
            selectVideos: () => Promise<string[]>;
            selectThumbnail: () => Promise<Thumbnail | null>;
            startJob: (payload: StartJobPayload) => Promise<{ success: boolean }>;
            onJobProgress: (callback: (msg: JobProgress) => void) => () => void;
            listRenders: () => Promise<RenderedVideo[]>;
            cancelJob: () => Promise<{ success: boolean }>;
            getCredentialsStatus: () => Promise<{ exists: boolean; path?: string }>;
            importCredentials: () => Promise<{ success: boolean; path?: string }>;
            connectToYouTube: () => Promise<{ success: boolean }>;
            getGCPAuthStatus: () => Promise<{ credentials: boolean; token: boolean }>;
            listPlaylists: () => Promise<{
                id: string;
                title: string;
            }[]>;
            showInFolder: (filePath: string) => Promise<void>;
            openLogsFolder: () => Promise<void>;
            openExternal: (url: string) => Promise<void>;
            onAuthCallback: (
                callback: (url: string) => void,
            ) => () => void;
            getYouTubeChannel: () => Promise<{
                channel_id: string
                channel_name: string
                channel_handle?: string
                channel_thumbnail?: string
            }>
        };
    }
}