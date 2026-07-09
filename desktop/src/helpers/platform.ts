import fs from "fs";
import path from "path";
import { app } from "electron";

export const isWindows = process.platform === "win32";
export const isMac = process.platform === "darwin";
export const isLinux = process.platform === "linux";

export const isDev = !app.isPackaged;

export function ensureExecutable(filePath: string) {
    if (!isWindows && fs.existsSync(filePath)) {
        fs.chmodSync(filePath, 0o755);
    }
}

export function preparePackagedBinary(filePath: string) {
    if (!isDev) {
        ensureExecutable(filePath);
    }
}

export function getPackagedFFmpegPath() {
    return path.join(
        process.resourcesPath,
        "ffmpeg",
        isWindows ? "ffmpeg.exe" : "ffmpeg"
    );
}

export function getPackagedFFprobePath() {
    return path.join(
        process.resourcesPath,
        "ffmpeg",
        isWindows ? "ffprobe.exe" : "ffprobe"
    );
}

export function getPythonExecutable() {
    return isWindows ? "python" : "python3";
}

export function getWorkerExecutable() {
    return isWindows ? "worker.exe" : "worker";
}

export function getTokenExecutable() {
    return isWindows ? "get_token.exe" : "get_token";
}