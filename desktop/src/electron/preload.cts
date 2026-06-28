const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  selectVideos: () => ipcRenderer.invoke("select-videos"),
  selectThumbnail: () => ipcRenderer.invoke("select-thumbnail"),
  startJob: (payload: any) => ipcRenderer.invoke("start-job", payload),
  onJobProgress: (callback: (msg: any) => void) => {
    ipcRenderer.on("job-progress", (_event: any, msg: any) => {
      callback(msg);
    });
    return () => ipcRenderer.removeAllListeners("job-progress");
  },
  listRenders: () => ipcRenderer.invoke("list-renders"),
  cancelJob: () => ipcRenderer.invoke("cancel-job"),
  uploadExisting: (payload: any) => ipcRenderer.invoke("start-job,", {
    ...payload,
    mode: "upload-existing"
  }),
  getAuthStatus: () => ipcRenderer.invoke("get-auth-status"),
  importCredentials: () => ipcRenderer.invoke("import-credentials"),
  connectToYouTube: () => ipcRenderer.invoke("connect-to-youtube"),
  listPlaylists: () => ipcRenderer.invoke("list-playlists"),
  showInFolder: (filePath: string) => ipcRenderer.invoke("show-in-folder", filePath),
  openLogsFolder: () => ipcRenderer.invoke("open-logs-folder"),
});