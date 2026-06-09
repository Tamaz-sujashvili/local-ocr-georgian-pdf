"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

async function linkBundledRuntimeForPackaging(buildDir, bundledRuntimeDir) {
  const exportDir = path.join(buildDir, "bundled-runtime-for-pack");

  if (fs.existsSync(exportDir)) {
    try {
      await fsp.rm(exportDir, { recursive: true, force: true });
    } catch (error) {
      if (!["EBUSY", "EPERM", "EACCES"].includes(error?.code)) {
        throw error;
      }

      const staleExport = path.join(buildDir, `bundled-runtime-for-pack-stale-${Date.now()}`);
      await fsp.rename(exportDir, staleExport);
    }
  }

  await fsp.cp(bundledRuntimeDir, exportDir, { recursive: true });
}

module.exports = {
  linkBundledRuntimeForPackaging,
};
