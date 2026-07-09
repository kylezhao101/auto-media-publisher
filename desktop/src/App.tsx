import { useState } from "react";
import type { Encoder, PerformanceMode, Visibility } from "./vite-env";
import Select, { type MultiValue } from 'react-select'
import type { RenderedVideo, PlaylistOption, Thumbnail } from "./types/amp";
import { DEFAULT_TITLE, DEFAULT_DESCRIPTION } from "./constants/defaults";
import { useAuthStatus } from "./hooks/useAuthStatus";
import { useRenders } from "./hooks/useRenders";
import { useJobRunner } from "./hooks/useJobRunner";
import { usePlaylists } from "./hooks/usePlaylists";

function App() {
  const [videos, setVideos] = useState<string[]>([]);
  const [thumbnail, setThumbnail] = useState<Thumbnail | null>(null);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [encoder, setEncoder] = useState<Encoder>("gpu");
  const [performanceMode, setPerformanceMode] =
    useState<PerformanceMode>("balanced");
  const [visibilityStatus, setVisibilityStatus] =
    useState<Visibility>("private");

  const { authStatus, importCredentials, refreshAuthStatus } = useAuthStatus();
  const { renders, loadRenders } = useRenders();
  const {
    progress,
    setProgress,
    isRunning,
    startJob,
    uploadExisting,
    cancelJob,
  } = useJobRunner();

  const {
    playlistOptions,
    selectedPlaylistIds,
    setSelectedPlaylistIds,
    isLoadingPlaylists,
    loadPlaylists,
  } = usePlaylists({ authStatus, setProgress });

  const handleConnectYouTube = async () => {
    setProgress({ stage: "warning", message: "Opening Google sign-in..." });

    try {
      const result = await window.electronAPI.connectToYouTube();

      if (result.success) {
        await refreshAuthStatus();
        setProgress({ stage: "done", message: "YouTube connected." });
      }
    } catch (err) {
      setProgress({
        stage: "warning",
        message: `YouTube connection failed: ${String(err)}`,
      });
    }
  };

  const handleSelectVideos = async () => {
    const selected = await window.electronAPI.selectVideos();
    setVideos(selected);
  };

  const handleSelectThumbnail = async () => {
    const selected = await window.electronAPI.selectThumbnail();
    setThumbnail(selected);
  };

  const handleStartJob = () =>
    startJob({
      videos,
      thumbnail,
      title,
      description,
      encoder,
      performanceMode,
      visibilityStatus,
      selectedPlaylistIds,
      loadRenders,
    });

  const handleUploadExisting = (render: RenderedVideo) =>
    uploadExisting({
      render,
      thumbnail,
      title,
      description,
      encoder,
      performanceMode,
      visibilityStatus,
      selectedPlaylistIds,
    });


  const handleCancelJob = () => cancelJob(loadRenders);

  const progressLabel = () => {
    if (!progress) return "";
    if (progress.stage === "rendering") {
      return `Rendering… ${progress.percent ?? 0}%`;
    }
    if (progress.stage === "uploading") {
      return `Uploading… ${progress.percent ?? 0}%`;
    }
    if (progress.stage === "done") {
      return progress.video_id
        ? `Done. Video ID: ${progress.video_id}`
        : `${progress.message ?? "Done"}`;
    }
    if (progress.stage === "warning") return `${progress.message}`;
    return "";
  };

  const canStart = thumbnail && videos.length > 0 && authStatus.token;

  return (
    <main className="app-shell">
      <section className="auth-card">
        <div>
          <h2>Connection</h2>

          <div className="status-grid">
            <span className="muted">Credentials</span>
            <span className={authStatus.credentials ? "success" : "warning"}>
              {authStatus.credentials ? "Loaded" : "Missing"}
            </span>

            <span className="muted">YouTube</span>
            <span className={authStatus.token ? "success" : "warning"}>
              {authStatus.token ? "Connected" : "Not connected"}
            </span>
          </div>
        </div>

        <div className="row">
          <button onClick={importCredentials} disabled={isRunning}>
            Import credentials
          </button>

          <button
            onClick={handleConnectYouTube}
            disabled={isRunning || !authStatus.credentials}
          >
            Connect YouTube
          </button>
          <button
            type="button"
            onClick={() => window.electronAPI.openLogsFolder()}
          >
            Open logs
          </button>
        </div>
      </section>

      <section className="publish-card">
        <div className="media-panel">
          <div>
            <h2>Media</h2>
            <p className="muted">Choose source clips and a thumbnail.</p>
          </div>

          <button onClick={handleSelectVideos} disabled={isRunning}>
            Select clips
          </button>

          {videos.length > 0 ? (
            <div className="clip-list">
              {videos.map((video) => (
                <div className="clip-item" key={video}>
                  {video}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No clips selected.</div>
          )}

          <button onClick={handleSelectThumbnail} disabled={isRunning}>
            Select thumbnail
          </button>

          {thumbnail ? (
            <img
              src={thumbnail.preview}
              alt="thumbnail"
              className="thumbnail-preview"
            />
          ) : (
            <div className="thumbnail-placeholder">No thumbnail selected.</div>
          )}
        </div>

        <div className="details-panel">
          <div>
            <h2>Publishing details</h2>
            <p className="muted">Set video metadata and rendering options.</p>
          </div>

          <label className="form-row">
            <span>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isRunning}
            />
          </label>

          <label className="form-row">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isRunning}
              rows={12}
            />
          </label>

          <div className="settings-row">
            <label className="form-row">
              <span>Encoder</span>
              <select
                value={encoder}
                onChange={(e) => setEncoder(e.target.value as "cpu" | "gpu")}
                disabled={isRunning}
              >
                <option value="gpu">GPU / NVIDIA NVENC</option>
                <option value="cpu">CPU / x264</option>
              </select>
            </label>

            <label className="form-row">
              <span>Performance</span>
              <select
                value={performanceMode}
                onChange={(e) =>
                  setPerformanceMode(
                    e.target.value as "fast" | "balanced" | "low"
                  )
                }
                disabled={isRunning}
              >
                <option value="fast">Fast</option>
                <option value="balanced">Balanced</option>
                <option value="low">Low impact</option>
              </select>
            </label>
          </div>

          <div className="settings-row">
            <label className="form-row">
              <span>Visibility</span>
              <select
                value={visibilityStatus}
                onChange={(e) =>
                  setVisibilityStatus(
                    e.target.value as "private" | "unlisted" | "public"
                  )
                }
              >
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </label>
            <label className="form-row">
              <span>Playlists</span>

              <Select<PlaylistOption, true>
                classNamePrefix="playlist-select"
                isMulti
                options={playlistOptions}
                isDisabled={isRunning || !authStatus.token}
                placeholder={
                  authStatus.token ? "Select playlists..." : "Connect YouTube first"
                }
                onChange={(selected: MultiValue<PlaylistOption>) => {
                  setSelectedPlaylistIds(selected.map((option) => option.value));
                }}
              />

              <button
                type="button"
                onClick={loadPlaylists}
                disabled={
                  isRunning ||
                  isLoadingPlaylists ||
                  !authStatus.token
                }
              >
                {isLoadingPlaylists
                  ? "Refreshing..."
                  : "Refresh playlists"}
              </button>
            </label>
          </div>

          <div className="actions">
            <button
              className="primary-button"
              onClick={handleStartJob}
              disabled={isRunning || !canStart}
            >
              {isRunning ? "Processing…" : "Start processing"}
            </button>

            {isRunning && (
              <button className="danger-button" onClick={handleCancelJob}>
                Cancel job
              </button>
            )}
          </div>

          {!authStatus.token && (
            <p className="warning small-text">
              Connect YouTube before starting an upload.
            </p>
          )}
        </div>
      </section>

      {progress && (
        <section className="progress-card">
          <div className="row between">
            <strong>{progressLabel()}</strong>
          </div>

          {(progress.stage === "rendering" || progress.stage === "uploading") && (
            <progress value={progress.percent ?? 0} max={100} />
          )}
        </section>
      )}

      <section>
        <div className="row between">
          <div>
            <h2>Existing rendered videos</h2>
            <p className="muted">Retry uploads without rendering again.</p>
          </div>

          <button onClick={loadRenders} disabled={isRunning}>
            Refresh
          </button>
        </div>

        {renders.length > 0 ? (
          <div className="render-list">
            {renders.map((render) => (
              <div className="render-item" key={render.path}>
                <div>
                  {render.name}
                  <p className="muted">
                    {(render.size / 1024 / 1024 / 1024).toFixed(2)} GB ·{" "}
                    {new Date(render.modifiedAt).toLocaleString()}
                  </p>
                </div>
                <div className="row">
                  <button
                    onClick={() => handleUploadExisting(render)}
                    disabled={isRunning || !authStatus.token}
                  >
                    Upload this
                  </button>
                  <button
                    type="button"
                    onClick={() => window.electronAPI.showInFolder(render.path)}
                  >
                    Show in folder
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No rendered videos found.</div>
        )}
      </section>
    </main>
  );
}

export default App;