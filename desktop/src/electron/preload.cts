const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getEncoders: (performanceMode: string) =>
    ipcRenderer.invoke("get-encoders", performanceMode),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  selectVideos: () => ipcRenderer.invoke("select-videos"),
  selectThumbnail: () => ipcRenderer.invoke("select-thumbnail"),
  startJob: (payload: any) => ipcRenderer.invoke("start-job", payload),
  onJobProgress: (callback: (msg: any) => void) => {
    const listener = (_event: any, msg: any) => {
      callback(msg);
    };
    ipcRenderer.on("job-progress", listener);
    return () => ipcRenderer.removeListener("job-progress", listener);
  },
  onYouTubeTokenRequest: (callback: (request: any) => void) => {
    const listener = (_event: any, request: any) => callback(request);
    ipcRenderer.on("youtube-token-request", listener);
    return () => ipcRenderer.removeListener("youtube-token-request", listener);
  },
  respondYouTubeToken: (response: any) =>
    ipcRenderer.invoke("youtube-token-response", response),
  listRenders: () => ipcRenderer.invoke("list-renders"),
  cancelJob: () => ipcRenderer.invoke("cancel-job"),
  uploadExisting: (payload: any) =>
    ipcRenderer.invoke("start-job", {
      ...payload,
      mode: "upload-existing",
    }),
  getGCPAuthStatus: () => ipcRenderer.invoke("get-auth-status"),
  importCredentials: () => ipcRenderer.invoke("import-credentials"),
  connectToYouTube: () => ipcRenderer.invoke("connect-to-youtube"),
  listPlaylists: () => ipcRenderer.invoke("list-playlists"),
  showInFolder: (filePath: string) =>
    ipcRenderer.invoke("show-in-folder", filePath),
  openLogsFolder: () => ipcRenderer.invoke("open-logs-folder"),
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  onAuthCallback: (callback: (url: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) => {
      callback(url);
    };

    ipcRenderer.on("auth-callback", listener);

    return () => {
      ipcRenderer.removeListener("auth-callback", listener);
    };
  },
  getYouTubeChannel: () => ipcRenderer.invoke("get-youtube-channel"),
});
