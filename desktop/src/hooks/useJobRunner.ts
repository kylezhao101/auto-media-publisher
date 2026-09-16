import { useState } from "react";
import type {
    JobProgress,
    RenderedVideo,
    Thumbnail,
    YouTubeAuth,
} from "../types/amp"
import type { Encoder, PerformanceMode, Visibility } from "../vite-env";
import { desktopNotification } from "../helpers/notifications";
import { recordSuccessfulUpload } from "@/api/organizations";
import { supabase } from "../helpers/supabase"


type SharedJobArgs = {
    organizationId: string | null;
    thumbnail: Thumbnail | null;
    title: string;
    description: string;
    encoder: Encoder;
    performanceMode: PerformanceMode;
    visibilityStatus: Visibility;
    selectedPlaylistIds: string[];
    youtubeAuth: YouTubeAuth;
};

type StartJobArgs = SharedJobArgs & {
    videos: string[];
    loadRenders: () => Promise<void>;
};

type UploadExistingArgs = SharedJobArgs & {
    render: RenderedVideo;
};

async function recordUpload(
    args: SharedJobArgs,
    videoId: string,
): Promise<void> {
    if (!args.organizationId) {
        return;
    }

    try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
            throw error;
        }

        if (!data.session) {
            throw new Error("You must be signed in to record the upload.");
        }

        await recordSuccessfulUpload(
            args.organizationId,
            args.title,
            videoId,
            data.session.access_token,
        );
    } catch (error) {
        console.error("Failed to record upload", error);

        desktopNotification(
            "Upload history not saved",
            "Your video uploaded successfully, but its activity record could not be saved.",
        );
    }
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

                if (msg.video_id) {
                    void recordUpload(args, msg.video_id);
                }

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
        } catch (err) {
            const message = String(err);

            setProgress({ stage: "warning", message });
            desktopNotification("Job failed", message);

            setIsRunning(false);
            cleanup();
        }

        try {
            await args.loadRenders();
        } catch (error) {
            console.error("Failed to refresh rendered videos", error);
        }
    };

    const uploadExisting = async (args: UploadExistingArgs) => {
        setIsRunning(true);
        setProgress({ stage: "uploading", percent: 0 });

        const cleanup = window.electronAPI.onJobProgress((msg) => {
            setProgress(msg);

            if (msg.stage === "done") {
                setIsRunning(false);
                cleanup();

                desktopNotification(
                    "Upload Complete",
                    msg.video_id
                        ? `Video uploaded successfully. ID: ${msg.video_id}`
                        : msg.message ?? "Your video was uploaded successfully.",
                );

                if (msg.video_id) {
                    void recordUpload(args, msg.video_id);
                }
            }

            if (msg.stage === "warning") {
                desktopNotification(
                    "Upload Warning",
                    msg.message ?? "The job finished with a warning.",
                );

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