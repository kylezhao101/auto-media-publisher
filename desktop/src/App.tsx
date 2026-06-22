import { useEffect, useState } from "react";
import type { Encoder, PerformanceMode, Visibility } from "./vite-env";
import Select, { type MultiValue } from 'react-select'

const DEFAULT_TITLE = "2026.6.7 | Saul's Conversion | Pastor Jiang";
const DEFAULT_DESCRIPTION = `Saul's Conversion Acts 9:1-9

[Offering]
The offering is done through e-Transfer;
Please e-mail your offerings to this address:
voffer@fcnabc.org

[More Info]
Our in-person service takes place every Sunday at 2:30PM,
for more information check out our website!
https://www.fcnabc.ca
`;

type JobProgress = {
  stage: "rendering" | "uploading" | "done" | "warning";
  percent?: number;
  video_id?: string;
  message?: string;
};

type RenderedVideo = {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
};

type AuthStatus = {
  credentials: boolean;
  token: boolean;
};

type Playlist = {
  id: string;
  title: string;
};

function App() {
  const [videos, setVideos] = useState<string[]>([]);
  const [thumbnail, setThumbnail] = useState<{
    path: string;
    preview: string;
  } | null>(null);

  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [renders, setRenders] = useState<RenderedVideo[]>([]);
  const [encoder, setEncoder] = useState<Encoder>("gpu");
  const [performanceMode, setPerformanceMode] = useState<
    PerformanceMode
  >("balanced");

  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);

  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    credentials: false,
    token: false,
  });

  const [visibilityStatus, setVisibilityStatus] = useState<Visibility>("private");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);

  type PlaylistOption = {
    value: string;
    label: string;
  };

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

  useEffect(() => {
    refreshAuthStatus();
    loadRenders();
  }, []);

  const refreshAuthStatus = async () => {
    const result = await window.electronAPI.getAuthStatus();
    setAuthStatus(result);
  };

  const handleImportCredentials = async () => {
    window.electronAPI.importCredentials();
    await refreshAuthStatus();
  };

  const handleConnectYouTube = async () => {
    setIsRunning(true);
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
    } finally {
      setIsRunning(false);
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

  const handleStartJob = async () => {
    setIsRunning(true);
    setProgress({ stage: "rendering", percent: 0 });

    const cleanup = window.electronAPI.onJobProgress((msg) => {
      setProgress(msg);

      if (msg.stage === "done" || msg.stage === "warning") {
        setIsRunning(false);
        cleanup();
      }
    });

    try {
      await window.electronAPI.startJob({
        mode: "render-and-upload",
        clips: videos,
        thumbnail,
        title,
        description,
        encoder,
        performance_mode: performanceMode,
        visibility: visibilityStatus,
        playlist_ids: selectedPlaylistIds,
      });

      await loadRenders();
    } catch (err) {
      setProgress({ stage: "warning", message: String(err) });
      setIsRunning(false);
      cleanup();
      await loadRenders();
    }
  };

  const loadRenders = async () => {
    const existing = await window.electronAPI.listRenders();
    setRenders(existing);
  };

  const handleCancelJob = async () => {
    await window.electronAPI.cancelJob();
    setIsRunning(false);
    setProgress({ stage: "warning", message: "Job cancelled." });
    await loadRenders();
  };

  const handleUploadExisting = async (render: RenderedVideo) => {
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
        thumbnail,
        title,
        description,
        output_path: render.path,
        encoder,
        performance_mode: performanceMode,
        visibility: visibilityStatus,
        playlist_ids: selectedPlaylistIds
      });
    } catch (err) {
      setProgress({ stage: "warning", message: String(err) });
      setIsRunning(false);
      cleanup();
    }
  };

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
          <button onClick={handleImportCredentials} disabled={isRunning}>
            Import credentials
          </button>

          <button
            onClick={handleConnectYouTube}
            disabled={isRunning || !authStatus.credentials}
          >
            Connect YouTube
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

                <button
                  onClick={() => handleUploadExisting(render)}
                  disabled={isRunning || !authStatus.token}
                >
                  Upload this
                </button>
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