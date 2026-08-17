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
import { ensureExecutable, getAppDataDir, getLogDir } from "./../helpers/paths.js";
import { ChildProcess, spawn } from "child_process";

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(
      "amp",
      process.execPath,
      [path.resolve(process.argv[1])]
    )
  }
} else {
  app.setAsDefaultProtocolClient("amp")
}

app.on("second-instance", (_event, argv) => {
  console.log("SECOND INSTANCE ARGV:", argv)

  const url = argv.find((arg) =>
    arg.startsWith("amp://")
  )

  console.log("DEEP LINK:", url)

  if (url) {
    mainWindow?.webContents.send(
      "auth-callback",
      url
    )
  }

  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.focus()
  }
})

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
    mainWindow.loadFile(
      path.join(__dirname, "../../dist/index.html")
    );
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
    const url = argv.find((arg) =>
      arg.startsWith("amp://")
    );

    if (url) {
      mainWindow?.webContents.send(
        "auth-callback",
        url
      );
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
  createWindow()

  const url = process.argv.find((arg) =>
    arg.startsWith("amp://")
  )

  if (url) {
    console.log("COLD START DEEP LINK:", url)

    mainWindow?.webContents.once(
      "did-finish-load",
      () => {
        mainWindow?.webContents.send(
          "auth-callback",
          url
        )
      }
    )
  }
})

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

ipcMain.handle(
  "get-youtube-channel",
  async () => {
    const workerCwd =
      isDev
        ? workerDir
        : packagedWorkerDir;

    preparePackagedBinary(
      workerBin,
    );

    const child = spawn(
      workerBin,
      workerArgs,
      {
        cwd: workerCwd,
        env: getWorkerEnv(),
      },
    );

    child.stdin.write(
      JSON.stringify({
        mode: "get-channel",
      }),
    );

    child.stdin.end();


    return new Promise(
      (resolve, reject) => {
        let output = "";
        let errorOutput = "";

        child.stdout.on(
          "data",
          (data: Buffer) => {
            output += data.toString();
          },
        );

        child.stderr.on(
          "data",
          (data: Buffer) => {
            errorOutput += data.toString();
          },
        );

        child.on(
          "close",
          (code) => {
            if (code !== 0) {
              reject(
                new Error(
                  errorOutput ||
                  "Failed to load YouTube channel",
                ),
              );

              return;
            }

            try {
              resolve(
                JSON.parse(output),
              );
            } catch {
              reject(
                new Error(
                  "YouTube channel response was not valid JSON",
                ),
              );
            }
          },
        );
      },
    );
  },
);

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

ipcMain.handle(
  "start-job",
  async (event, payload) => {
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


    const youtubeAuth =
      youtube_auth ?? {
        type: "local",
      };


    /*
     * Personal publishing still uses the
     * existing local Google token.
     */
    if (youtubeAuth.type === "local") {
      const tokenPath = path.join(
        getAppDataDir(),
        "google-token.json",
      );

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
      youtubeAuth.type === "access_token" &&
      !youtubeAuth.access_token
    ) {
      throw new Error(
        "Organization YouTube access token is missing."
      );
    }


    const outputDir = path.join(
      app.getPath("videos"),
      "Auto Media Publisher",
    );

    fs.mkdirSync(
      outputDir,
      {
        recursive: true,
      },
    );


    const safeTitle = title
      .replace(
        /[<>:"/\\|?*]/g,
        "",
      )
      .slice(
        0,
        80,
      );


    const outputPath =
      mode === "upload-existing"
        ? payload.output_path
        : path.join(
          outputDir,
          `${safeTitle}_${Date.now()}.mp4`,
        );


    const job = JSON.stringify({
      mode:
        mode ??
        "render-and-upload",

      clips,

      thumbnail:
        thumbnail?.path ??
        null,

      title,
      description,

      output_path:
        outputPath,

      encoder,

      performance_mode,

      visibility,

      playlist_ids,

      youtube_auth:
        youtubeAuth,
    });


    const workerCwd =
      isDev
        ? workerDir
        : packagedWorkerDir;


    const ffmpegPath =
      isDev
        ? "ffmpeg"
        : getPackagedFFmpegPath();


    const ffprobePath =
      isDev
        ? "ffprobe"
        : getPackagedFFprobePath();


    if (!isDev) {
      ensureExecutable(
        ffmpegPath,
      );

      ensureExecutable(
        ffprobePath,
      );
    }


    const workerEnv = {
      ...getWorkerEnv(),

      FFMPEG_PATH:
        ffmpegPath,

      FFPROBE_PATH:
        ffprobePath,
    };


    preparePackagedBinary(
      workerBin,
    );


    const child = spawn(
      workerBin,
      workerArgs,
      {
        cwd:
          workerCwd,

        env:
          workerEnv,
      },
    );


    currentJob = child;


    child.stdin.write(
      job,
    );

    child.stdin.end();


    child.stdout.on(
      "data",
      (data: Buffer) => {
        for (
          const line of
          data
            .toString()
            .trim()
            .split("\n")
        ) {
          try {
            event.sender.send(
              "job-progress",
              JSON.parse(line),
            );
          } catch { }
        }
      },
    );


    let stderr = "";


    child.stderr.on(
      "data",
      (data: Buffer) => {
        const text =
          data.toString();

        stderr += text;

        console.error(
          "[worker]",
          text,
        );
      },
    );


    return new Promise(
      (resolve, reject) => {
        child.on(
          "close",
          (code) => {
            currentJob = null;

            if (code === 0) {
              resolve({
                success: true,
              });
            } else {
              reject(
                new Error(
                  stderr ||
                  `Worker exited with code ${code}`,
                ),
              );
            }
          },
        );
      },
    );
  },
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

ipcMain.handle("open-external", async (_event, url: string) => {
  await shell.openExternal(url)
})

app.on("before-quit", () => {
  if (currentJob) {
    currentJob.kill("SIGTERM");
  }
});
