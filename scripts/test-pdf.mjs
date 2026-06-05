#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const pdfPath = process.argv[2];
const baseUrl = process.argv[3] || "http://127.0.0.1:8765";

if (!pdfPath || !fs.existsSync(pdfPath)) {
  console.error("Usage: node scripts/test-pdf.mjs <path-to.pdf> [baseUrl]");
  process.exit(2);
}

const originalName = path.basename(pdfPath);
const bytes = fs.readFileSync(pdfPath);
console.log(`Testing ${originalName} (${bytes.length} bytes)`);

const form = new FormData();
form.append("pdf", new Blob([bytes], { type: "application/pdf" }), originalName);
form.append("action", "ocr");
form.append("language", "kat");

const started = Date.now();
const response = await fetch(`${baseUrl}/convert`, { method: "POST", body: form });
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

console.log(`Status: ${response.status} (${elapsed}s)`);
console.log(`Content-Type: ${response.headers.get("content-type")}`);
console.log(`Content-Disposition: ${response.headers.get("content-disposition")}`);

if (!response.ok) {
  const text = await response.text();
  console.error(text.slice(0, 4000));
  process.exit(1);
}

const out = Buffer.from(await response.arrayBuffer());
const outPath = path.join(path.dirname(pdfPath), `${path.parse(originalName).name}.ocr.test.pdf`);
fs.writeFileSync(outPath, out);
console.log(`Wrote ${out.length} bytes -> ${outPath}`);
console.log(`Header: ${out.slice(0, 5).toString("utf8")}`);
