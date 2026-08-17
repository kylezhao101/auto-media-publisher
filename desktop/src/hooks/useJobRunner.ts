import { useState } from "react";
import type {
    JobProgress,
    RenderedVideo,
    Thumbnail,
    YouTubeAuth,
} from "../types/amp"
import type { Encoder, PerformanceMode, Visibility } from "../vite-env";
import { desktopNotification } from "../helpers/notifications";


type StartJobArgs = {
    videos: string[]
    thumbnail: Thumbnail | null
    title: string
    description: string
    encoder: Encoder
    performanceMode: PerformanceMode
    visibilityStatus: Visibility
    selectedPlaylistIds: string[]
    youtubeAuth: YouTubeAuth
    loadRenders: () => Promise<void>
}


type UploadExistingArgs = {
    render: RenderedVideo
    thumbnail: Thumbnail | null
    title: string
    description: string
    encoder: Encoder
    performanceMode: PerformanceMode
    visibilityStatus: Visibility
    selectedPlaylistIds: string[]
    youtubeAuth: YouTubeAuth
}

export function useJobRunner() {
    const [progress, setProgress] = useState<JobProgress | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    const startJob = async (args: StartJobArgs) => {
        setIsRunning(true);
        setProgress({ stage: "rendering", percent: 0 });

        const cleanup = window.electronAPI.onJobProgress((msg) => {
            setProgress(msg);

            if (msg.stage === "done") {
                desktopNotification(
                    "Upload Complete",
                    msg.video_id
                        ? `Video uploaded successfully. ID: ${msg.video_id}`
                        : msg.message ?? "Your video was uploaded successfully."
                );

                setIsRunning(false);
                cleanup();
            }

            if (msg.stage === "warning") {
                desktopNotification(
                    "Upload Warning",
                    msg.message ?? "The job finished with a warning."
                )

                setIsRunning(false);
                cleanup();
            }
        });

        try {
            await window.electronAPI.startJob({
                mode: "render-and-upload",
                clips: args.videos,
                thumbnail: args.thumbnail,
                title: args.title,
                description: args.description,
                encoder: args.encoder,
                performance_mode: args.performanceMode,
                visibility: args.visibilityStatus,
                playlist_ids: args.selectedPlaylistIds,

                youtube_auth: args.youtubeAuth
            });

            await args.loadRenders();
        } catch (err) {
            const message = String(err);

            setProgress({ stage: "warning", message });
            desktopNotification("Job failed", message);

            setIsRunning(false);
            cleanup();
            await args.loadRenders();
        }
    };

    const uploadExisting = async (args: UploadExistingArgs) => {
        setIsRunning(true);
        setProgress({ stage: "uploading", percent: 0 });

        const cleanup = window.electronAPI.onJobProgress((msg) => {
            setProgress(msg);

            if (msg.stage === "done" || msg.stage === "warning") {
                setIsRunning(false);
                cleanup();
            }
        });

        try {
            await window.electronAPI.startJob({
                mode: "upload-existing",
                clips: [],
                thumbnail: args.thumbnail,
                title: args.title,
                description: args.description,
                output_path: args.render.path,
                encoder: args.encoder,
                performance_mode: args.performanceMode,
                visibility: args.visibilityStatus,
                playlist_ids: args.selectedPlaylistIds,

                youtube_auth: args.youtubeAuth
            });
        } catch (err) {
            const message = String(err);
            setProgress({ stage: "warning", message });
            desktopNotification("Job failed", message);

            setIsRunning(false);
            cleanup();
        }
    };

    const cancelJob = async (loadRenders: () => Promise<void>) => {
        await window.electronAPI.cancelJob();
        setIsRunning(false);
        setProgress({ stage: "warning", message: "Job cancelled." });
        await loadRenders();
    };

    return {
        progress,
        setProgress,
        isRunning,
        startJob,
        uploadExisting,
        cancelJob,
    };
}