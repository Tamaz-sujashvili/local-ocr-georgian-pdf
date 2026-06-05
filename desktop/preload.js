"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  retryStartup: () => ipcRenderer.invoke("desktop:retry-startup"),
  openRuntimeFolder: () => ipcRenderer.invoke("desktop:open-runtime-folder"),
  savePdf: (arrayBuffer, suggestedName) =>
    ipcRenderer.invoke("desktop:save-pdf", suggestedName, arrayBuffer),
});
