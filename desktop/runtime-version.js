"use strict";

const path = require("node:path");

const RUNTIME_ENV_VERSION = "2026-06-09-1";

function getBundledRuntimeDir(buildDir) {
  return path.join(buildDir, `bundled-runtime-${RUNTIME_ENV_VERSION}`);
}

function getExtraCondaPackages() {
  if (process.platform === "win32") {
    // conda-forge tesseract links libcurl.dll but does not declare libcurl as a dependency.
    return ["libcurl"];
  }

  return [];
}

module.exports = {
  RUNTIME_ENV_VERSION,
  getBundledRuntimeDir,
  getExtraCondaPackages,
};
