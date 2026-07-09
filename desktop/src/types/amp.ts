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
    credentials: boolean;
    token: boolean;
};

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