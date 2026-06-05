#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import toIco from "to-ico";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "assets", "icons");
const pngPath = path.join(iconsDir, "icon.png");
const icoPath = path.join(iconsDir, "icon.ico");

if (!fs.existsSync(pngPath)) {
  console.error(`Missing ${pngPath}`);
  process.exit(1);
}

const png = fs.readFileSync(pngPath);
const ico = await toIco(png, { resize: true, sizes: [16, 24, 32, 48, 64, 128, 256] });
fs.writeFileSync(icoPath, ico);
console.log(`Wrote ${icoPath}`);
