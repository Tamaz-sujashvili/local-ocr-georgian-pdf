"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  retryStartup: () => ipcRenderer.invoke("desktop:retry-startup"),
  openRuntimeFolder: () => ipcRenderer.invoke("desktop:open-runtime-folder"),
});
