import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import updater from "electron-updater";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import {
  isDev,
  preparePackagedBinary,
  getPackagedFFmpegPath,
  getPackagedFFprobePath,
  getPythonExecutable,
  getWorkerExecutable,
  getTokenExecutable,
  isMac,
} from "./../helpers/platform.js";
import {
  ensureExecutable,
  getAppDataDir,
  getLogDir,
} from "./../helpers/paths.js";
import { ChildProcess, spawn } from "child_process";
import { createInterface } from "readline";
import { WorkerTokens } from "../helpers/workerTokens.js";
import type { YouTubeTokenResponse } from "../vite-env.js";
import type { EncoderCapabilities, PerformanceMode } from "../vite-env.js";

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("amp", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("amp");
}

app.on("second-instance", (_event, argv) => {
  console.log("SECOND INSTANCE ARGV:", argv);

  const url = argv.find((arg) => arg.startsWith("amp://"));

  console.log("DEEP LINK:", url);

  if (url) {
    mainWindow?.webContents.send("auth-callback", url);
  }

  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  }
});

const { autoUpdater } = updater;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workerDir = isDev
  ? path.join(app.getAppPath(), "../worker")
  : path.join(__dirname, "../../worker");

const packagedWorkerDir = path.join(process.resourcesPath, "worker");

const pythonBin = getPythonExecutable();

const workerExecutable = getWorkerExecutable();
const tokenExecutable = getTokenExecutable();

const workerBin = isDev
  ? pythonBin
  : path.join(packagedWorkerDir, workerExecutable);

const workerArgs = isDev ? [path.join(workerDir, "worker.py")] : [];

const getTokenBin = isDev
  ? pythonBin
  : path.join(packagedWorkerDir, tokenExecutable);

const getTokenArgs = isDev ? [path.join(workerDir, "get_token.py")] : [];

let currentJob: ChildProcess | null = null;
let currentTokens: WorkerTokens | null = null;
let mainWindow: BrowserWindow | null = null;

const getWindowTitle = () => `Auto Media Publisher v${app.getVersion()}`;

function setupAutoUpdater(win: BrowserWindow) {
  if (isDev) return;

  autoUpdater.autoDownload = false;

  if (isMac) {
    autoUpdater.on("update-available", async (info) => {
      const result = await dialog.showMessageBox(win, {
        type: "info",
        title: "Update available",
        message: `Version ${info.version} is available.`,
        detail:
          "Automatic updates are not supported on macOS yet.\n\nDownload the latest version from GitHub Releases and replace the application in your Applications folder.",
        buttons: ["Open Releases", "Later"],
        defaultId: 0,
        cancelId: 1,
      });

      if (result.response === 0) {
        shell.openExternal(
          "https://github.com/kylezhao101/auto-media-publisher/releases/latest"
        );
      }
    });

    autoUpdater.checkForUpdates();
    return;
  }

  autoUpdater.on("update-available", async (info) => {
    const result = await dialog.showMessageBox(win, {
      type: "info",
      title: "Update available",
      message: `Version ${info.version} is available.`,
      detail: "Download and install it now?",
      buttons: ["Download", "Later"],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("download-progress", (progress) => {
    console.log(`Downloading: ${progress.percent.toFixed(1)}%`);

    win.webContents.send("update-progress", {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", async (info) => {
    const result = await dialog.showMessageBox(win, {
      type: "info",
      title: "Update ready",
      message: `Version ${info.version} has been downloaded.`,
      detail: "Restart now to install the update?",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("error", (err) => {
    dialog.showMessageBox(win, {
      type: "error",
      title: "Updater error",
      message: err.message,
    });
  });

  autoUpdater.checkForUpdates();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    title: getWindowTitle(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault();
    mainWindow?.setTitle(getWindowTitle());
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.setTitle(getWindowTitle());
  });

  setupAutoUpdater(mainWindow);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith("amp://"));

    if (url) {
      mainWindow?.webContents.send("auth-callback", url);
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }

      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  const url = process.argv.find((arg) => arg.startsWith("amp://"));

  if (url) {
    console.log("COLD START DEEP LINK:", url);

    mainWindow?.webContents.once("did-finish-load", () => {
      mainWindow?.webContents.send("auth-callback", url);
    });
  }
});

function getWorkerEnv() {
  return {
    ...process.env,
    AMP_APP_DATA_DIR: getAppDataDir(),
  };
}

const encoderChecks = new Map<string, Promise<EncoderCapabilities>>();

function getEncoders(
  performanceMode: PerformanceMode
): Promise<EncoderCapabilities> {
  if (!["fast", "balanced", "low"].includes(performanceMode)) {
    return Promise.reject(new Error("Invalid performance mode"));
  }
  const cached = encoderChecks.get(performanceMode);
  if (cached) return cached;
  const check = new Promise<EncoderCapabilities>((resolve, reject) => {
    preparePackagedBinary(workerBin);
    const child = spawn(workerBin, workerArgs, {
      cwd: isDev ? workerDir : packagedWorkerDir,
      env: {
        ...getWorkerEnv(),
        FFMPEG_PATH: isDev ? "ffmpeg" : getPackagedFFmpegPath(),
      },
      windowsHide: true,
    });
    let output = "";
    let errors = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(
        new Error("Encoder detection timed out. You can select CPU encoding.")
      );
    }, 60000);
    child.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      errors += data.toString();
    });
    child.stdin.on("error", () => {
      /* Process errors are handled below. */
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0)
        return reject(new Error(errors || "Encoder detection failed."));
      try {
        resolve(JSON.parse(output));
      } catch {
        reject(new Error("Invalid encoder detection response."));
      }
    });
    child.stdin.end(
      JSON.stringify({
        mode: "detect-encoders",
        performance_mode: performanceMode,
      })
    );
  });
  encoderChecks.set(performanceMode, check);
  check.catch(() => {
    encoderChecks.delete(performanceMode);
  });
  return check;
}

ipcMain.handle("get-encoders", (_event, performanceMode: PerformanceMode) =>
  getEncoders(performanceMode)
);

ipcMain.handle("open-logs-folder", async () => {
  await shell.openPath(getLogDir());
});

ipcMain.handle("get-app-version", async () => {
  return app.getVersion();
});

ipcMain.handle("get-credentials-status", async () => {
  const credentialsPath = path.join(getAppDataDir(), "gcp-credentials.json");

  return {
    exists: fs.existsSync(credentialsPath),
    path: credentialsPath,
  };
});

ipcMain.handle("import-credentials", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Google OAuth Credentials", extensions: ["json"] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false };
  }

  const sourcePath = result.filePaths[0];
  const destPath = path.join(getAppDataDir(), "gcp-credentials.json");

  let config;
  try {
    config = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  } catch {
    throw new Error(
      "This file is not valid JSON. Download the Desktop app OAuth credentials JSON from Google Cloud."
    );
  }
  const client = config?.installed;
  const required = ["client_id", "client_secret", "auth_uri", "token_uri"];
  if (
    !client ||
    required.some(
      (field) => typeof client[field] !== "string" || !client[field].trim()
    ) ||
    !Array.isArray(client.redirect_uris) ||
    !client.redirect_uris.length
  ) {
    throw new Error(
      "Choose a Desktop app OAuth credentials JSON, rather than an API key, service account, or Web application client."
    );
  }
  if (
    client.auth_uri !== "https://accounts.google.com/o/oauth2/auth" ||
    client.token_uri !== "https://oauth2.googleapis.com/token"
  ) {
    throw new Error(
      "The credentials must use Google's authorization and token endpoints. Download a fresh Desktop app JSON from Google Cloud."
    );
  }
  const credentialsChanged =
    !fs.existsSync(destPath) ||
    fs.readFileSync(destPath, "utf8") !== fs.readFileSync(sourcePath, "utf8");
  fs.copyFileSync(sourcePath, destPath);
  if (credentialsChanged) {
    const tokenPath = path.join(getAppDataDir(), "google-token.json");
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
  }

  return {
    success: true,
    path: destPath,
  };
});

ipcMain.handle("get-auth-status", async () => {
  const appDir = getAppDataDir();

  const credentialsPath = path.join(appDir, "gcp-credentials.json");
  const tokenPath = path.join(appDir, "google-token.json");

  return {
    credentials: fs.existsSync(credentialsPath),
    token: fs.existsSync(tokenPath),
  };
});

ipcMain.handle("connect-to-youtube", async () => {
  // const tokenPath = path.join(getAppDataDir(), "google-token.json");

  // if (fs.existsSync(tokenPath)) {
  //   fs.unlinkSync(tokenPath);
  // }

  preparePackagedBinary(getTokenBin);

  const child = spawn(getTokenBin, getTokenArgs, {
    cwd: isDev ? workerDir : packagedWorkerDir,
    env: getWorkerEnv(),
  });

  return new Promise((resolve, reject) => {
    child.on("error", () =>
      reject(
        new Error(
          "Could not start Google sign-in. Check the application installation and try again."
        )
      )
    );
    child.on("close", (code) => {
      code === 0
        ? resolve({ success: true })
        : reject(new Error("OAuth failed"));
    });
  });
});

ipcMain.handle("select-videos", async () => {
  console.log("select-videos called");

  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Videos", extensions: ["mp4", "mov", "mkv", "avi", "mxf"] },
    ],
  });

  console.log(result);

  if (result.canceled) return [];
  return result.filePaths;
});

ipcMain.handle("select-thumbnail", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
  });

  if (result.canceled) return null;

  const filePath = result.filePaths[0];
  const buffer = fs.readFileSync(filePath);

  return {
    path: filePath,
    preview: `data:image/jpeg;base64,${buffer.toString("base64")}`,
  };
});

ipcMain.handle("get-youtube-channel", async () => {
  const workerCwd = isDev ? workerDir : packagedWorkerDir;

  preparePackagedBinary(workerBin);

  const child = spawn(workerBin, workerArgs, {
    cwd: workerCwd,
    env: getWorkerEnv(),
  });

  child.stdin.write(
    JSON.stringify({
      mode: "get-channel",
    })
  );

  child.stdin.end();

  return new Promise((resolve, reject) => {
    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      errorOutput += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(errorOutput || "Failed to load YouTube channel"));

        return;
      }

      try {
        resolve(JSON.parse(output));
      } catch {
        reject(new Error("YouTube channel response was not valid JSON"));
      }
    });
  });
});

ipcMain.handle("list-playlists", async () => {
  const workerCwd = isDev ? workerDir : packagedWorkerDir;

  preparePackagedBinary(workerBin);

  const child = spawn(workerBin, workerArgs, {
    cwd: workerCwd,
    env: getWorkerEnv(),
  });

  child.stdin.write(
    JSON.stringify({
      mode: "list-playlists",
    })
  );
  child.stdin.end();

  return new Promise((resolve, reject) => {
    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      errorOutput += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(errorOutput || "Failed to load playlists"));
        return;
      }

      try {
        resolve(JSON.parse(output));
      } catch {
        reject(new Error("Playlist response was not valid JSON"));
      }
    });
  });
});

ipcMain.handle("start-job", async (event, payload) => {
  if (currentJob) throw new Error("A publishing job is already running.");
  const {
    clips,
    thumbnail,
    title,
    description,
    mode,
    encoder,
    performance_mode,
    visibility,
    playlist_ids,
    youtube_auth,
  } = payload;

  const youtubeAuth = youtube_auth ?? {
    type: "local",
  };

  /*
   * Personal publishing still uses the
   * existing local Google token.
   */
  if (youtubeAuth.type === "local") {
    const tokenPath = path.join(getAppDataDir(), "google-token.json");

    if (!fs.existsSync(tokenPath)) {
      throw new Error(
        "YouTube is not connected. Please connect YouTube first."
      );
    }
  }

  /*
   * Organization publishing receives only
   * a short-lived Google access token.
   */
  if (
    youtubeAuth.type === "organization" &&
    (!youtubeAuth.organization_id || !youtubeAuth.user_id || !payload.job_id)
  ) {
    throw new Error("Organization job identity is missing.");
  }

  const outputDir = path.join(app.getPath("videos"), "Auto Media Publisher");

  fs.mkdirSync(outputDir, {
    recursive: true,
  });

  const safeTitle = title.replace(/[<>:"/\\|?*]/g, "").slice(0, 80);

  const outputPath =
    mode === "upload-existing"
      ? payload.output_path
      : path.join(outputDir, `${safeTitle}_${Date.now()}.mp4`);

  const job = JSON.stringify({
    mode: mode ?? "render-and-upload",

    clips,

    thumbnail: thumbnail?.path ?? null,

    title,
    description,

    output_path: outputPath,

    encoder:
      encoder === "auto" && mode !== "upload-existing"
        ? await getEncoders(performance_mode ?? "balanced").then((result) => {
            if (!result.preferred)
              throw new Error(
                "No working video encoder found. Check your installation."
              );
            return result.preferred;
          })
        : encoder === "auto"
          ? "cpu"
          : encoder,

    performance_mode,

    visibility,

    playlist_ids,

    youtube_auth: youtubeAuth,
  });

  const workerCwd = isDev ? workerDir : packagedWorkerDir;

  const ffmpegPath = isDev ? "ffmpeg" : getPackagedFFmpegPath();

  const ffprobePath = isDev ? "ffprobe" : getPackagedFFprobePath();

  if (!isDev) {
    ensureExecutable(ffmpegPath);

    ensureExecutable(ffprobePath);
  }

  const workerEnv = {
    ...getWorkerEnv(),

    FFMPEG_PATH: ffmpegPath,

    FFPROBE_PATH: ffprobePath,
  };

  preparePackagedBinary(workerBin);

  if (currentJob) throw new Error("A publishing job is already running.");
  const child = spawn(workerBin, workerArgs, {
    cwd: workerCwd,

    env: workerEnv,
  });

  currentJob = child;
  const tokens = new WorkerTokens(
    payload.job_id,
    event.sender.id,
    (message) => {
      if (!child.stdin.destroyed)
        child.stdin.write(JSON.stringify(message) + "\n");
    },
    (request) => {
      if (!event.sender.isDestroyed())
        event.sender.send("youtube-token-request", request);
    }
  );
  currentTokens = tokens;
  // Keep stdin open for organization token responses. Auxiliary worker commands
  // still work with a single JSON payload followed by EOF.
  child.stdin.on("error", () => {});
  child.stdin.write(job + "\n");
  if (youtubeAuth.type !== "organization") child.stdin.end();
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    try {
      const message = JSON.parse(line);
      if (
        message.type === "token-request" &&
        youtubeAuth.type === "organization" &&
        typeof message.request_id === "string"
      ) {
        tokens.request(message.request_id);
      } else if (!event.sender.isDestroyed()) {
        event.sender.send("job-progress", message);
      }
    } catch {}
  });

  let stderr = "";

  child.stderr.on("data", (data: Buffer) => {
    const text = data.toString();

    stderr += text;

    console.error("[worker]", text);
  });

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      tokens.close();
      lines.close();
      if (currentJob === child) currentJob = null;
      if (currentTokens === tokens) currentTokens = null;
    };
    child.on("error", (error) => {
      cleanup();
      reject(error);
    });
    child.on("close", (code) => {
      cleanup();

      if (code === 0) {
        resolve({
          success: true,
        });
      } else {
        reject(new Error(stderr || `Worker exited with code ${code}`));
      }
    });
  });
});

ipcMain.handle(
  "youtube-token-response",
  (event, response: YouTubeTokenResponse) => {
    currentTokens?.respond(event.sender.id, response);
  }
);

ipcMain.handle("list-renders", async () => {
  const outputDir = path.join(app.getPath("videos"), "Auto Media Publisher");
  fs.mkdirSync(outputDir, { recursive: true });

  return fs
    .readdirSync(outputDir)
    .filter((file) => file.endsWith(".mp4"))
    .map((file) => {
      const fullPath = path.join(outputDir, file);
      const stat = fs.statSync(fullPath);

      return {
        name: file,
        path: fullPath,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
    });
});

ipcMain.handle("cancel-job", async () => {
  currentTokens?.close();
  currentTokens = null;
  if (currentJob) {
    currentJob.kill("SIGTERM");
    return { success: true };
  }

  return { success: false };
});

ipcMain.handle("show-in-folder", async (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle("open-external", async (_event, url: string) => {
  await shell.openExternal(url);
});

app.on("before-quit", () => {
  if (currentJob) {
    currentJob.kill("SIGTERM");
  }
});
