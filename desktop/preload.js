"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  retryStartup: () => ipcRenderer.invoke("desktop:retry-startup"),
  openDockerDesktop: () => ipcRenderer.invoke("desktop:open-docker-desktop"),
  openDockerDownload: () => ipcRenderer.invoke("desktop:open-docker-download"),
});
