import path from "path";
import fs from "fs";
import { app } from "electron/main";

export function getAppDataDir() {
    const appDir = path.join(app.getPath("appData"), "AutoMediaPublisher");
    fs.mkdirSync(appDir, { recursive: true });
    return appDir;
}

export function getLogDir() {
    const logDir = path.join(getAppDataDir(), "logs");
    fs.mkdirSync(logDir, { recursive: true });
    return logDir;
}
