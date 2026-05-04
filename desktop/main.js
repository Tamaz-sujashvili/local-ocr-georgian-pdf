"use strict";

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");

const APP_PORT = process.env.PORT || "8765";
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const HEALTH_URL = `${APP_URL}/healthz`;
const STARTUP_TIMEOUT_MS = 120000;
const POLL_INTERVAL_MS = 1500;
const DARWIN_EXTRA_BIN_DIRS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/Applications/Docker.app/Contents/Resources/bin",
];

let mainWindow = null;
let selectedComposeCommand = null;
let shouldStopBackendOnQuit = false;
let isStartingBackend = false;

function getBackendDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "backend");
  }

  return path.resolve(__dirname, "..");
}

function commandExists(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      shell: false,
    });

    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

function findExecutable(commandName) {
  const hasPathSeparator = commandName.includes(path.sep);
  const candidates = [];

  if (hasPathSeparator) {
    candidates.push(commandName);
  } else {
    const pathDirs = (process.env.PATH || "")
      .split(path.delimiter)
      .filter(Boolean);
    const extraDirs =
      process.platform === "darwin" ? DARWIN_EXTRA_BIN_DIRS : [];

    for (const dir of [...pathDirs, ...extraDirs]) {
      candidates.push(path.join(dir, commandName));
    }
  }

  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Keep searching.
    }
  }

  return null;
}

async function detectComposeCommand() {
  if (selectedComposeCommand) {
    return selectedComposeCommand;
  }

  const dockerBinary = findExecutable("docker");
  if (dockerBinary && (await commandExists(dockerBinary, ["compose", "version"]))) {
    selectedComposeCommand = {
      command: dockerBinary,
      baseArgs: ["compose"],
    };
    return selectedComposeCommand;
  }

  const dockerComposeBinary = findExecutable("docker-compose");
  if (
    dockerComposeBinary &&
    (await commandExists(dockerComposeBinary, ["version"]))
  ) {
    selectedComposeCommand = {
      command: dockerComposeBinary,
      baseArgs: [],
    };
    return selectedComposeCommand;
  }

  throw new Error(
    "Docker CLI was not found. Install/start Docker Desktop, then ensure 'docker' is available (for macOS GUI apps this is usually in /opt/homebrew/bin or /usr/local/bin)."
  );
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          [
            `Command failed: ${command} ${args.join(" ")}`,
            stdout.trim(),
            stderr.trim(),
          ]
            .filter(Boolean)
            .join("\n\n")
        )
      );
    });
  });
}

async function runCompose(args) {
  const compose = await detectComposeCommand();
  return runCommand(compose.command, [...compose.baseArgs, ...args], {
    cwd: getBackendDir(),
    env: {
      ...process.env,
      PORT: APP_PORT,
    },
  });
}

function waitForHealth(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();

        if (response.statusCode === 200) {
          resolve();
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error("The OCR backend did not become ready in time."));
          return;
        }

        setTimeout(attempt, POLL_INTERVAL_MS);
      });

      request.on("error", () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(
            new Error(
              "The OCR backend did not respond in time. Confirm that Docker Desktop is installed and running."
            )
          );
          return;
        }

        setTimeout(attempt, POLL_INTERVAL_MS);
      });
    };

    attempt();
  });
}

function getDesktopHtmlPath(fileName) {
  return path.join(__dirname, fileName);
}

function ensureDesktopFilesExist() {
  for (const fileName of ["loading.html", "error.html", "preload.js"]) {
    const filePath = getDesktopHtmlPath(fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing desktop asset: ${filePath}`);
    }
  }
}

async function startBackend() {
  if (isStartingBackend) {
    return;
  }

  isStartingBackend = true;

  try {
    const compose = await detectComposeCommand();
    const dockerBinary = findExecutable("docker");

    if (!dockerBinary) {
      throw new Error(
        "Docker CLI was not found. Install/start Docker Desktop and make sure the Docker binary is available to apps."
      );
    }

    await runCommand(dockerBinary, ["info"]);
    await runCommand(compose.command, [...compose.baseArgs, "up", "-d", "--build"], {
      cwd: getBackendDir(),
      env: {
        ...process.env,
        PORT: APP_PORT,
      },
    });
    shouldStopBackendOnQuit = true;
    await waitForHealth(HEALTH_URL, STARTUP_TIMEOUT_MS);
  } finally {
    isStartingBackend = false;
  }
}

async function stopBackend() {
  if (!shouldStopBackendOnQuit) {
    return;
  }

  try {
    await runCompose(["stop"]);
  } catch (error) {
    console.error("Failed to stop backend:", error);
  }
}

function buildErrorUrl(message) {
  const params = new URLSearchParams({ message });
  return `file://${getDesktopHtmlPath("error.html")}?${params.toString()}`;
}

async function bootWindow() {
  ensureDesktopFilesExist();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 780,
    show: false,
    title: "Local OCR",
    backgroundColor: "#fbf7f2",
    webPreferences: {
      preload: getDesktopHtmlPath("preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadFile(getDesktopHtmlPath("loading.html"));

  try {
    await startBackend();
    await mainWindow.loadURL(APP_URL);
  } catch (error) {
    await mainWindow.loadURL(buildErrorUrl(error.message));
    dialog.showErrorBox("Local OCR startup failed", error.message);
  }
}

ipcMain.handle("desktop:retry-startup", async () => {
  if (!mainWindow) {
    return { ok: false, message: "Main window is not available." };
  }

  try {
    await mainWindow.loadFile(getDesktopHtmlPath("loading.html"));
    await startBackend();
    await mainWindow.loadURL(APP_URL);
    return { ok: true };
  } catch (error) {
    await mainWindow.loadURL(buildErrorUrl(error.message));
    return { ok: false, message: error.message };
  }
});

ipcMain.handle("desktop:open-docker-download", async () => {
  await shell.openExternal("https://www.docker.com/products/docker-desktop/");
});

app.whenReady().then(bootWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  if (!shouldStopBackendOnQuit) {
    return;
  }

  event.preventDefault();
  shouldStopBackendOnQuit = false;
  await stopBackend();
  app.exit(0);
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await bootWindow();
  }
});
