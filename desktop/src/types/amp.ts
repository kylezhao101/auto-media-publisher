import type { Encoder, PerformanceMode, Visibility } from "../vite-env";

export type { Encoder, PerformanceMode, Visibility };

export type JobProgress = {
    stage: "rendering" | "uploading" | "done" | "warning";
    percent?: number;
    video_id?: string;
    message?: string;
};

export type RenderedVideo = {
    name: string;
    path: string;
    size: number;
    modifiedAt: string;
};

export type AuthStatus = {
    credentials: boolean
    token: boolean
    channelId?: string
    channelName?: string
    channelHandle?: string
    channelThumbnail?: string
}

export type Playlist = {
    id: string;
    title: string;
};

export type PlaylistOption = {
    value: string;
    label: string;
};

export type Thumbnail = {
    path: string;
    preview: string;
}

export type Clip = {
    path: string
    name: string
    size: number
    duration: number
}

export type YouTubeConnectionInfo = {
    connected: boolean
    channelId?: string
    channelName?: string
    channelHandle?: string
    channelThumbnail?: string
}

export type YouTubeAuth =
    | {
        type: "local"
    }
    | {
        type: "access_token"
        access_token: string
    }