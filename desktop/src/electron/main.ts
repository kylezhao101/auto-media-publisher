import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import updater from "electron-updater"
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
  isMac
} from "./../helpers/platform.js";
import { getAppDataDir, getLogDir } from "./../helpers/paths.js";
import { ChildProcess, spawn } from "child_process";

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

const workerArgs = isDev
  ? [path.join(workerDir, "worker.py")]
  : [];

const getTokenBin = isDev
  ? pythonBin
  : path.join(packagedWorkerDir, tokenExecutable);

const getTokenArgs = isDev
  ? [path.join(workerDir, "get_token.py")]
  : [];

let currentJob: ChildProcess | null = null;

const getWindowTitle = () => `Auto Media Publisher v${app.getVersion()}`;

function setupAutoUpdater(win: BrowserWindow) {
  if (isDev) return;

  autoUpdater.forceDevUpdateConfig = true;
  autoUpdater.checkForUpdates();
  autoUpdater.on("update-available", (info) => {
    dialog.showMessageBox(win, {
      type: "info",
      title: "Update available",
      message: `Update available: ${info.version}`,
    });
  });

  autoUpdater.on("error", (err) => {
    dialog.showMessageBox(win, {
      type: "error",
      title: "Updater error",
      message: err.message,
    });
  });

  autoUpdater.on("update-downloaded", async (info) => {
    const result = await dialog.showMessageBox(win, {
      type: "info",
      title: "Update Ready",
      message: `Version ${info.version} has been downloaded.`,
      detail: "Restart now to install the update?",
      buttons: ["Restart", "Later"],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.checkForUpdates();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    title: getWindowTitle(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.on("page-title-updated", (event) => {
    event.preventDefault();
    win.setTitle(getWindowTitle());
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.webContents.on("did-finish-load", () => {
    win.setTitle(getWindowTitle());
  });

  setupAutoUpdater(win);
}

app.whenReady().then(createWindow);

function getWorkerEnv() {
  return {
    ...process.env,
    AMP_APP_DATA_DIR: getAppDataDir(),
  };
}


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

  fs.copyFileSync(sourcePath, destPath);

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
  const tokenPath = path.join(getAppDataDir(), "google-token.json");

  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath);
  }

  preparePackagedBinary(getTokenBin);

  const child = spawn(getTokenBin, getTokenArgs, {
    cwd: isDev ? workerDir : packagedWorkerDir,
    env: getWorkerEnv(),
  });

  return new Promise((resolve, reject) => {
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
    filters: [{ name: "Videos", extensions: ["mp4", "mov", "mkv", "avi", "mxf"] }],
  });

  console.log(result);

  if (result.canceled) return [];
  return result.filePaths;
});

ipcMain.handle("select-thumbnail", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] },
    ],
  });

  if (result.canceled) return null;

  const filePath = result.filePaths[0];
  const buffer = fs.readFileSync(filePath);

  return {
    path: filePath,
    preview: `data:image/jpeg;base64,${buffer.toString("base64")}`,
  };
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
  const {
    clips,
    thumbnail,
    title,
    description,
    mode,
    encoder,
    performance_mode,
    visibility,
    playlist_ids
  } = payload;

  const tokenPath = path.join(getAppDataDir(), "google-token.json");

  if (!fs.existsSync(tokenPath)) {
    throw new Error("YouTube is not connected. Please connect YouTube first.");
  }

  const outputDir = path.join(app.getPath("videos"), "Auto Media Publisher");
  fs.mkdirSync(outputDir, { recursive: true });

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
    encoder,
    performance_mode,
    visibility,
    playlist_ids
  });

  const workerCwd = isDev ? workerDir : packagedWorkerDir;

  const workerEnv = {
    ...getWorkerEnv(),

    FFMPEG_PATH: isDev || isMac ? "ffmpeg" : getPackagedFFmpegPath(),
    FFPROBE_PATH: isDev || isMac ? "ffprobe" : getPackagedFFprobePath(),
  };

  preparePackagedBinary(workerBin);

  const child = spawn(workerBin, workerArgs, {
    cwd: workerCwd,
    env: workerEnv,
  });

  currentJob = child;

  child.stdin.write(job);
  child.stdin.end();

  child.stdout.on("data", (data: Buffer) => {
    for (const line of data.toString().trim().split("\n")) {
      try {
        event.sender.send("job-progress", JSON.parse(line));
      } catch { }
    }
  });

  child.stderr.on("data", (data: Buffer) => {
    console.error("[worker]", data.toString());
  });

  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      currentJob = null;

      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
});

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
  if (currentJob) {
    currentJob.kill("SIGTERM");
    currentJob = null;
    return { success: true };
  }

  return { success: false };
});

ipcMain.handle("show-in-folder", async (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
});

app.on("before-quit", () => {
  if (currentJob) {
    currentJob.kill("SIGTERM");
  }
});
