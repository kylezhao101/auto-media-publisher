import path from "path";
import fs from "fs";
import { app } from "electron/main";

const APP_NAME = "AutoMediaPublisher";

export function getAppDataDir(): string {
    const appDir = path.join(app.getPath("appData"), APP_NAME);
    fs.mkdirSync(appDir, { recursive: true });
    return appDir;
}

export function getLogDir(): string {
    const logDir = path.join(getAppDataDir(), "logs");
    fs.mkdirSync(logDir, { recursive: true });
    return logDir;
}

export function getPackagedFFmpegPath(): string {
    const executable =
        process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

    return path.join(
        process.resourcesPath,
        "ffmpeg",
        executable,
    );
}

export function getPackagedFFprobePath(): string {
    const executable =
        process.platform === "win32" ? "ffprobe.exe" : "ffprobe";

    return path.join(
        process.resourcesPath,
        "ffmpeg",
        executable,
    );
}

export function ensureExecutable(filePath: string): void {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Bundled executable is missing: ${filePath}`);
    }

    if (process.platform !== "win32") {
        fs.chmodSync(filePath, 0o755);
    }
}