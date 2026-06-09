#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "assets", "icons");
const pngPath = path.join(iconsDir, "icon.png");
const icoPath = path.join(iconsDir, "icon.ico");

if (!fs.existsSync(pngPath)) {
  console.error(`Missing ${pngPath}`);
  process.exit(1);
}

const png = fs.readFileSync(pngPath);
const ico = await pngToIco(png);
fs.writeFileSync(icoPath, ico);
console.log(`Wrote ${icoPath}`);
