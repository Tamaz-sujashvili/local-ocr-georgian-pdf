"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  retryStartup: () => ipcRenderer.invoke("desktop:retry-startup"),
  openDockerDownload: () => ipcRenderer.invoke("desktop:open-docker-download"),
});
