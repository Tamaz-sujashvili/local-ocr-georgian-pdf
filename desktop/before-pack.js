"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

module.exports = async function beforePack() {
  if (process.env.SKIP_BUNDLE_OCR_RUNTIME === "1") {
    console.log("Skipping bundled OCR runtime (SKIP_BUNDLE_OCR_RUNTIME=1).");
    return;
  }

  const bundledRuntime = path.join(__dirname, "..", "build", "bundled-runtime");
  const stampPath = path.join(bundledRuntime, ".local-ocr-runtime-version");

  if (fs.existsSync(stampPath)) {
    console.log("Reusing existing bundled OCR runtime.");
    return;
  }

  console.log("Preparing bundled OCR runtime for installer...");
  const result = spawnSync(process.execPath, [path.join(__dirname, "bundle-runtime.js")], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error("Failed to bundle OCR runtime before packaging.");
  }
};
