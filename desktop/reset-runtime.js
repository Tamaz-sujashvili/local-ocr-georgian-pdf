"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const names = ["local-ocr-georgian-pdf", "Local OCR"];

for (const name of names) {
  const runtimeDir = path.join(os.homedir(), "Library", "Application Support", name, "runtime");
  if (!fs.existsSync(runtimeDir)) {
    continue;
  }

  fs.rmSync(runtimeDir, { recursive: true, force: true });
  console.log(`Removed ${runtimeDir}`);
}

console.log("Runtime cleared. Restart Local OCR to reinstall.");
