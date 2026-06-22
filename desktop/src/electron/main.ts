import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { ChildProcess, spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const workerDir = path.join(__dirname, "../../worker");

let currentJob: ChildProcess | null = null;

const packagedWorkerDir = path.join(process.resourcesPath, "worker");

const workerBin = isDev
  ? "python"
  : path.join(packagedWorkerDir, "worker.exe");

const workerArgs = isDev ? [path.join(workerDir, "worker.py")] : [];

const getTokenBin = isDev
  ? "python"
  : path.join(packagedWorkerDir, "get_token.exe");

const getTokenArgs = isDev ? [path.join(workerDir, "get_token.py")] : [];

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

function getAppDataDir() {
  const appDir = path.join(app.getPath("appData"), "AutoMediaPublisher");
  fs.mkdirSync(appDir, { recursive: true });
  return appDir;
}

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

  return {
    credentials: fs.existsSync(
      path.join(appDir, "gcp-credentials.json")
    ),
    token: fs.existsSync(
      path.join(appDir, "google-token.json")
    ),
  };
});

ipcMain.handle("connect-to-youtube", async () => {
  const tokenPath = path.join(getAppDataDir(), "google-token.json");

  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath);
  }

  const child = spawn(getTokenBin, getTokenArgs, {
    cwd: isDev ? workerDir : packagedWorkerDir,
    env: process.env,
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

  const child = spawn(workerBin, workerArgs, {
    cwd: workerCwd,
    env: process.env,
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
    ...process.env,

    FFMPEG_PATH: isDev
      ? "ffmpeg"
      : path.join(
        process.resourcesPath,
        "ffmpeg",
        "ffmpeg.exe"
      ),

    FFPROBE_PATH: isDev
      ? "ffprobe"
      : path.join(
        process.resourcesPath,
        "ffmpeg",
        "ffprobe.exe"
      ),
  };

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


app.on("before-quit", () => {
  if (currentJob) {
    currentJob.kill("SIGTERM");
  }
});