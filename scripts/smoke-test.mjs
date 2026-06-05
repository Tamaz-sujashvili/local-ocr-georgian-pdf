#!/usr/bin/env node
/**
 * Smoke test: health check + minimal PDF convert against local backend.
 * Usage: node scripts/smoke-test.mjs [baseUrl]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseUrl = process.argv[2] || "http://127.0.0.1:8765";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "scripts", "fixtures", "smoke-test.pdf");

function createMinimalPdf() {
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  const pdf = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 44 >>stream
BT /F1 24 Tf 20 100 Td (Smoke) Tj ET
endstream endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000367 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
449
%%EOF`;
  fs.writeFileSync(fixturePath, pdf, "utf-8");
}

async function checkHealth() {
  const response = await fetch(`${baseUrl}/healthz`);
  const body = await response.json();
  if (!response.ok || body.status !== "ok") {
    throw new Error(`Health check failed: ${response.status} ${JSON.stringify(body)}`);
  }
  console.log("OK  GET /healthz");
}

async function checkConvert() {
  const form = new FormData();
  const blob = new Blob([fs.readFileSync(fixturePath)], { type: "application/pdf" });
  form.append("pdf", blob, "smoke-test.pdf");
  form.append("action", "ocr");
  form.append("language", "kat");

  const response = await fetch(`${baseUrl}/convert`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Convert failed (${response.status}):\n${text.slice(0, 2000)}`);
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength < 100) {
    throw new Error(`Convert returned too little data (${bytes.byteLength} bytes)`);
  }

  const header = Buffer.from(bytes.slice(0, 5)).toString("utf-8");
  if (!header.startsWith("%PDF")) {
    throw new Error(`Convert response is not a PDF (header: ${header})`);
  }

  console.log(`OK  POST /convert (${bytes.byteLength} bytes PDF)`);
}

async function main() {
  createMinimalPdf();
  console.log(`Smoke testing ${baseUrl}`);
  await checkHealth();
  await checkConvert();
  console.log("Smoke test passed.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
