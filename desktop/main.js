"use strict";

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const APP_PORT = process.env.PORT || "8765";
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const HEALTH_URL = `${APP_URL}/healthz`;
const STARTUP_TIMEOUT_MS = 120000;
const POLL_INTERVAL_MS = 1500;
const RUNTIME_ENV_VERSION = "2026-05-05-2";
const RUNTIME_INSTALL_ATTEMPTS = 4;
const RUNTIME_INSTALL_RETRY_DELAY_MS = 5000;

let mainWindow = null;
let backendProcess = null;
let shouldStopBackendOnQuit = false;
let startupPromise = null;

function getBackendDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "backend");
  }

  return path.resolve(__dirname, "..");
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

function getUserRuntimeRoot() {
  return path.join(app.getPath("userData"), "runtime");
}

function getMicromambaRootPrefix() {
  return path.join(getUserRuntimeRoot(), "micromamba-root");
}

function getRuntimeEnvPrefix() {
  return path.join(getUserRuntimeRoot(), "ocr-runtime");
}

function getEnvStampPath() {
  return path.join(getRuntimeEnvPrefix(), ".local-ocr-runtime-version");
}

function getRuntimeEnvironmentFile() {
  return path.join(getBackendDir(), "runtime", "environment.yml");
}

function getBackendAppPath() {
  return path.join(getBackendDir(), "app.py");
}

function getMicromambaArchivePath() {
  const fileName = process.platform === "win32" ? "micromamba.tar.bz2" : "micromamba.tar.bz2";
  return path.join(getUserRuntimeRoot(), fileName);
}

function getMicromambaBinaryPath() {
  if (process.platform === "win32") {
    return path.join(getUserRuntimeRoot(), "micromamba.exe");
  }

  return path.join(getUserRuntimeRoot(), "bin", "micromamba");
}

function getPlatformTarget() {
  if (process.platform === "darwin") {
    return process.arch === "arm64" ? "osx-arm64" : "osx-64";
  }

  if (process.platform === "win32") {
    return "win-64";
  }

  if (process.platform === "linux") {
    return process.arch === "arm64" ? "linux-aarch64" : "linux-64";
  }

  throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
}

function getMicromambaDownloadUrl() {
  return `https://micro.mamba.pm/api/micromamba/${getPlatformTarget()}/latest`;
}

function isProcessRunning(pid) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      shell: false,
      windowsHide: true,
      stdio: options.stdio || ["ignore", "pipe", "pipe"],
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

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveRedirectUrl(currentUrl, redirectLocation) {
  return new URL(redirectLocation, currentUrl).toString();
}

function downloadFile(url, destination, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const target = fs.createWriteStream(destination);

    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        if (redirectCount >= 10) {
          target.close();
          fs.unlink(destination, () => {
            reject(new Error(`Download failed: too many redirects while fetching ${url}`));
          });
          return;
        }

        const nextUrl = resolveRedirectUrl(url, response.headers.location);
        target.close();
        fs.unlink(destination, () => {
          downloadFile(nextUrl, destination, redirectCount + 1).then(resolve).catch(reject);
        });
        return;
      }

      if (response.statusCode !== 200) {
        target.close();
        fs.unlink(destination, () => {
          reject(new Error(`Download failed: ${url} returned ${response.statusCode}`));
        });
        return;
      }

      response.pipe(target);
      target.on("finish", () => {
        target.close(resolve);
      });
    });

    request.on("error", (error) => {
      target.close();
      fs.unlink(destination, () => reject(error));
    });

    target.on("error", (error) => {
      request.destroy(error);
      fs.unlink(destination, () => reject(error));
    });
  });
}

async function ensureMicromambaBinary() {
  const micromambaPath = getMicromambaBinaryPath();
  if (fs.existsSync(micromambaPath)) {
    return micromambaPath;
  }

  await fsp.mkdir(getUserRuntimeRoot(), { recursive: true });
  const archivePath = getMicromambaArchivePath();

  await downloadFile(getMicromambaDownloadUrl(), archivePath);

  if (process.platform === "win32") {
    await runCommand("tar", ["xf", archivePath], {
      cwd: getUserRuntimeRoot(),
    });

    const extracted = path.join(getUserRuntimeRoot(), "Library", "bin", "micromamba.exe");
    if (!fs.existsSync(extracted)) {
      throw new Error("Micromamba download completed, but micromamba.exe was not extracted.");
    }

    await fsp.copyFile(extracted, micromambaPath);
  } else {
    await runCommand("tar", ["-xjf", archivePath, "-C", getUserRuntimeRoot(), "bin/micromamba"]);
    await fsp.chmod(micromambaPath, 0o755);
  }

  return micromambaPath;
}

async function removePartialRuntimeEnvironment(micromambaPath, envPrefix) {
  if (!fs.existsSync(envPrefix)) {
    return;
  }

  try {
    await runCommand(micromambaPath, ["env", "remove", "-y", "-p", envPrefix], {
      cwd: getBackendDir(),
      env: {
        ...process.env,
        MAMBA_ROOT_PREFIX: getMicromambaRootPrefix(),
      },
    });
  } catch {
    await fsp.rm(envPrefix, { recursive: true, force: true });
  }
}

async function createRuntimeEnvironment(micromambaPath, envPrefix) {
  let lastError = null;

  for (let attempt = 1; attempt <= RUNTIME_INSTALL_ATTEMPTS; attempt += 1) {
    try {
      if (attempt > 1) {
        await removePartialRuntimeEnvironment(micromambaPath, envPrefix);
      }

      await runCommand(
        micromambaPath,
        [
          "create",
          "-y",
          "-p",
          envPrefix,
          "-f",
          getRuntimeEnvironmentFile(),
        ],
        {
          cwd: getBackendDir(),
          env: {
            ...process.env,
            MAMBA_NO_LOW_SPEED_LIMIT: "1",
            MAMBA_ROOT_PREFIX: getMicromambaRootPrefix(),
          },
        }
      );

      return;
    } catch (error) {
      lastError = error;

      if (attempt < RUNTIME_INSTALL_ATTEMPTS) {
        await delay(RUNTIME_INSTALL_RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    [
      `The OCR runtime failed to install after ${RUNTIME_INSTALL_ATTEMPTS} attempts.`,
      "Check your internet connection, then use Retry startup. Already downloaded package files are reused automatically.",
      lastError?.message,
    ]
      .filter(Boolean)
      .join("\n\n")
  );
}

async function ensureRuntimeEnvironment() {
  const micromambaPath = await ensureMicromambaBinary();
  const envPrefix = getRuntimeEnvPrefix();
  const stampPath = getEnvStampPath();

  let currentStamp = null;
  try {
    currentStamp = await fsp.readFile(stampPath, "utf-8");
  } catch {
    currentStamp = null;
  }

  if (currentStamp?.trim() === RUNTIME_ENV_VERSION) {
    return { micromambaPath, envPrefix };
  }

  await fsp.mkdir(getMicromambaRootPrefix(), { recursive: true });
  await createRuntimeEnvironment(micromambaPath, envPrefix);

  await fsp.writeFile(stampPath, `${RUNTIME_ENV_VERSION}\n`, "utf-8");
  return { micromambaPath, envPrefix };
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
              "The local OCR backend did not respond in time. The runtime may still be downloading or installing."
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

async function startPythonBackend() {
  const { micromambaPath, envPrefix } = await ensureRuntimeEnvironment();
  const backendAppPath = getBackendAppPath();

  const child = spawn(
    micromambaPath,
    [
      "run",
      "-p",
      envPrefix,
      "python",
      backendAppPath,
    ],
    {
      cwd: getBackendDir(),
      env: {
        ...process.env,
        PORT: APP_PORT,
        MAMBA_ROOT_PREFIX: getMicromambaRootPrefix(),
        PYTHONUNBUFFERED: "1",
      },
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  let stderr = "";
  let stdout = "";

  child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString();
    if (stdout.length > 8000) {
      stdout = stdout.slice(-8000);
    }
  });

  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
    if (stderr.length > 8000) {
      stderr = stderr.slice(-8000);
    }
  });

  child.on("exit", (code) => {
    if (!shouldStopBackendOnQuit && code !== 0) {
      console.error("Backend exited unexpectedly", { code, stdout, stderr });
    }
  });

  backendProcess = child;
  shouldStopBackendOnQuit = true;

  try {
    await waitForHealth(HEALTH_URL, STARTUP_TIMEOUT_MS);
  } catch (error) {
    if (isProcessRunning(child.pid)) {
      child.kill("SIGTERM");
    }

    throw new Error(
      [
        error.message,
        stdout.trim(),
        stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n\n")
    );
  }
}

async function ensureBackendStarted() {
  if (backendProcess && isProcessRunning(backendProcess.pid)) {
    return;
  }

  if (startupPromise) {
    return startupPromise;
  }

  startupPromise = (async () => {
    await startPythonBackend();
  })();

  try {
    await startupPromise;
  } finally {
    startupPromise = null;
  }
}

async function stopBackend() {
  if (!backendProcess || !isProcessRunning(backendProcess.pid)) {
    return;
  }

  const child = backendProcess;
  backendProcess = null;

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (isProcessRunning(child.pid)) {
        child.kill("SIGKILL");
      }
      resolve();
    }, 5000);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill("SIGTERM");
  });
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
    await ensureBackendStarted();
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
    await ensureBackendStarted();
    await mainWindow.loadURL(APP_URL);
    return { ok: true };
  } catch (error) {
    await mainWindow.loadURL(buildErrorUrl(error.message));
    return { ok: false, message: error.message };
  }
});

ipcMain.handle("desktop:open-runtime-folder", async () => {
  const runtimeDir = getUserRuntimeRoot();
  await fsp.mkdir(runtimeDir, { recursive: true });
  await shell.openPath(runtimeDir);
  return { ok: true };
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
