import { useState, useRef, useEffect } from "react";
import { listenForJobTokens } from "../helpers/jobTokens";
import type {
  JobProgress,
  RenderedVideo,
  Thumbnail,
  YouTubeAuth,
} from "../types/amp";
import type { Encoder, PerformanceMode, Visibility } from "../vite-env";
import { desktopNotification } from "../helpers/notifications";
import { recordSuccessfulUpload } from "@/api/organizations";
import { supabase } from "../helpers/supabase";

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
  videoId: string
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
      data.session.access_token
    );
  } catch (error) {
    console.error("Failed to record upload", error);

    desktopNotification(
      "Upload history not saved",
      "Your video uploaded successfully, but its activity record could not be saved."
    );
  }
}

export function useJobRunner() {
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const cleanupTokens = useRef<(() => void) | null>(null);
  const activeJob = useRef<string | null>(null);
  const cancelled = useRef(false);
  const cleanupProgress = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      cleanupTokens.current?.();
      cleanupProgress.current?.();
      cancelled.current = true;
    },
    []
  );

  const startJob = async (args: StartJobArgs) => {
    if (activeJob.current)
      throw new Error("A publishing job is already running.");
    const jobId = crypto.randomUUID();
    activeJob.current = jobId;
    cancelled.current = false;
    cleanupTokens.current = listenForJobTokens(jobId, args.youtubeAuth);
    setIsRunning(true);
    setProgress({ stage: "rendering", percent: 0 });

    const cleanup = window.electronAPI.onJobProgress((msg) => {
      if (cancelled.current) return;
      setProgress(msg);

      if (msg.stage === "done") {
        desktopNotification(
          "Upload Complete",
          msg.video_id
            ? `Video uploaded successfully. ID: ${msg.video_id}`
            : (msg.message ?? "Your video was uploaded successfully.")
        );

        if (msg.video_id) {
          void recordUpload(args, msg.video_id);
        }
      }

      if (msg.stage === "warning") {
        desktopNotification(
          "Upload Warning",
          msg.message ?? "The job finished with a warning."
        );
      }
    });
    cleanupProgress.current = cleanup;

    try {
      await window.electronAPI.startJob({
        job_id: jobId,
        mode: "render-and-upload",
        clips: args.videos,
        thumbnail: args.thumbnail,
        title: args.title,
        description: args.description,
        encoder: args.encoder,
        performance_mode: args.performanceMode,
        visibility: args.visibilityStatus,
        playlist_ids: args.selectedPlaylistIds,

        youtube_auth: args.youtubeAuth,
      });
    } catch (err) {
      if (!cancelled.current) {
        const message = String(err);

        setProgress({ stage: "warning", message });
        desktopNotification("Job failed", message);
      }
    } finally {
      cleanupTokens.current?.();
      cleanupTokens.current = null;
      cleanup();
      cleanupProgress.current = null;
      activeJob.current = null;
      setIsRunning(false);
    }

    try {
      await args.loadRenders();
    } catch (error) {
      console.error("Failed to refresh rendered videos", error);
    }
  };

  const uploadExisting = async (args: UploadExistingArgs) => {
    if (activeJob.current)
      throw new Error("A publishing job is already running.");
    const jobId = crypto.randomUUID();
    activeJob.current = jobId;
    cancelled.current = false;
    cleanupTokens.current = listenForJobTokens(jobId, args.youtubeAuth);
    setIsRunning(true);
    setProgress({ stage: "uploading", percent: 0 });

    const cleanup = window.electronAPI.onJobProgress((msg) => {
      if (cancelled.current) return;
      setProgress(msg);

      if (msg.stage === "done") {
        desktopNotification(
          "Upload Complete",
          msg.video_id
            ? `Video uploaded successfully. ID: ${msg.video_id}`
            : (msg.message ?? "Your video was uploaded successfully.")
        );

        if (msg.video_id) {
          void recordUpload(args, msg.video_id);
        }
      }

      if (msg.stage === "warning") {
        desktopNotification(
          "Upload Warning",
          msg.message ?? "The job finished with a warning."
        );
      }
    });
    cleanupProgress.current = cleanup;

    try {
      await window.electronAPI.startJob({
        job_id: jobId,
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

        youtube_auth: args.youtubeAuth,
      });
    } catch (err) {
      if (!cancelled.current) {
        const message = String(err);
        setProgress({ stage: "warning", message });
        desktopNotification("Job failed", message);
      }
    } finally {
      cleanupTokens.current?.();
      cleanupTokens.current = null;
      cleanup();
      cleanupProgress.current = null;
      activeJob.current = null;
      setIsRunning(false);
    }
  };

  const cancelJob = async (loadRenders: () => Promise<void>) => {
    cancelled.current = true;
    cleanupTokens.current?.();
    cleanupTokens.current = null;
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
