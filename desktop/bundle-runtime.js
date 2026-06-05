"use strict";

/**
 * Build-time script: create a self-contained OCR runtime inside build/
 * so release installers work offline without Docker or first-launch downloads.
 */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const https = require("node:https");
const path = require("node:path");
const { RUNTIME_ENV_VERSION } = require("./runtime-version");

const projectRoot = path.resolve(__dirname, "..");
const backendDir = projectRoot;
const buildDir = path.join(projectRoot, "build");
const bootstrapDir = path.join(buildDir, "bootstrap");
const bundledRuntimeDir = path.join(buildDir, "bundled-runtime");
const bundledToolsDir = path.join(buildDir, "bundled-tools");
const environmentFile = path.join(backendDir, "runtime", "environment.yml");
const INSTALL_ATTEMPTS = 4;
const RETRY_DELAY_MS = 5000;

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
  throw new Error(`Unsupported build platform: ${process.platform} ${process.arch}`);
}

function getMicromambaBinaryPath() {
  if (process.platform === "win32") {
    return path.join(bootstrapDir, "micromamba.exe");
  }
  return path.join(bootstrapDir, "bin", "micromamba");
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
          [`Command failed: ${command} ${args.join(" ")}`, stdout.trim(), stderr.trim()]
            .filter(Boolean)
            .join("\n\n")
        )
      );
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
          reject(new Error(`Download failed: too many redirects for ${url}`));
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
        reject(new Error(`Download failed: ${url} returned ${response.statusCode}`));
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
  });
}

async function ensureMicromambaBinary() {
  const micromambaPath = getMicromambaBinaryPath();
  if (fs.existsSync(micromambaPath)) {
    return micromambaPath;
  }

  await fsp.mkdir(bootstrapDir, { recursive: true });
  const archivePath = path.join(bootstrapDir, "micromamba.tar.bz2");
  const url = `https://micro.mamba.pm/api/micromamba/${getPlatformTarget()}/latest`;

  console.log("Downloading micromamba for build...");
  await downloadFile(url, archivePath);

  if (process.platform === "win32") {
    await runCommand("tar", ["xf", archivePath], { cwd: bootstrapDir });
    const extracted = path.join(bootstrapDir, "Library", "bin", "micromamba.exe");
    await fsp.copyFile(extracted, micromambaPath);
  } else {
    await runCommand("tar", ["-xjf", archivePath, "-C", bootstrapDir, "bin/micromamba"]);
    await fsp.chmod(micromambaPath, 0o755);
  }

  return micromambaPath;
}

async function createBundledRuntime(micromambaPath) {
  const mambaRoot = path.join(buildDir, "mamba-root");
  await fsp.rm(bundledRuntimeDir, { recursive: true, force: true });
  await fsp.mkdir(mambaRoot, { recursive: true });

  let lastError = null;
  for (let attempt = 1; attempt <= INSTALL_ATTEMPTS; attempt += 1) {
    try {
      if (attempt > 1) {
        await fsp.rm(bundledRuntimeDir, { recursive: true, force: true });
      }

      console.log(`Creating bundled OCR runtime (attempt ${attempt}/${INSTALL_ATTEMPTS})...`);
      await runCommand(
        micromambaPath,
        ["create", "-y", "-p", bundledRuntimeDir, "-f", environmentFile],
        {
          cwd: backendDir,
          env: {
            ...process.env,
            MAMBA_NO_LOW_SPEED_LIMIT: "1",
            MAMBA_ROOT_PREFIX: mambaRoot,
          },
        }
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt < INSTALL_ATTEMPTS) {
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

async function runBundledPython(scriptPath, args) {
  const micromambaPath = await ensureMicromambaBinary();
  await runCommand(
    micromambaPath,
    ["run", "-p", bundledRuntimeDir, "python", scriptPath, ...args],
    {
      cwd: backendDir,
      env: {
        ...process.env,
        MAMBA_ROOT_PREFIX: path.join(buildDir, "mamba-root"),
      },
    }
  );
}

async function bundleSupportAssets() {
  await fsp.mkdir(bundledToolsDir, { recursive: true });
  await runBundledPython(path.join(backendDir, "runtime", "ensure_tessdata.py"), [bundledRuntimeDir]);
  await runBundledPython(path.join(backendDir, "runtime", "ensure_optional_tools.py"), [bundledToolsDir]);
  await fsp.writeFile(
    path.join(bundledRuntimeDir, ".local-ocr-runtime-version"),
    `${RUNTIME_ENV_VERSION}\n`,
    "utf-8"
  );
}

async function main() {
  if (!fs.existsSync(environmentFile)) {
    throw new Error(`Missing runtime spec: ${environmentFile}`);
  }

  await fsp.mkdir(buildDir, { recursive: true });
  const micromambaPath = await ensureMicromambaBinary();
  await createBundledRuntime(micromambaPath);
  await bundleSupportAssets();

  console.log("Bundled OCR runtime ready:");
  console.log(`  ${bundledRuntimeDir}`);
  console.log(`  ${bundledToolsDir}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
