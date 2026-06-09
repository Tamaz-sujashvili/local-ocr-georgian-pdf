"use strict";

const { contextBridge, ipcRenderer } = require("electron");

function assertArrayBuffer(value) {
  if (!(value instanceof ArrayBuffer)) {
    throw new TypeError("Expected an ArrayBuffer.");
  }
}

function assertSuggestedName(value) {
  if (typeof value !== "string" || value.length > 255) {
    throw new TypeError("Invalid suggested file name.");
  }
}

contextBridge.exposeInMainWorld("desktopApp", {
  retryStartup: () => ipcRenderer.invoke("desktop:retry-startup"),
  openRuntimeFolder: () => ipcRenderer.invoke("desktop:open-runtime-folder"),
  savePdf: (arrayBuffer, suggestedName) => {
    assertArrayBuffer(arrayBuffer);
    assertSuggestedName(suggestedName);
    return ipcRenderer.invoke("desktop:save-pdf", suggestedName, arrayBuffer);
  },
});
