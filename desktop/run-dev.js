"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronBinary =
  process.platform === "win32"
    ? path.join(projectRoot, "node_modules", ".bin", "electron.cmd")
    : path.join(projectRoot, "node_modules", ".bin", "electron");

const child = spawn(electronBinary, ["."], {
  cwd: projectRoot,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
