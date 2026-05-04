# Local OCR

[![Download macOS DMG](https://img.shields.io/badge/Download-macOS%20DMG-black?style=for-the-badge&logo=apple)](https://github.com/suja-labarum/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-mac-arm64.dmg)
[![Download macOS ZIP](https://img.shields.io/badge/Download-macOS%20ZIP-grey?style=for-the-badge&logo=apple)](https://github.com/suja-labarum/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-mac-arm64.zip)
[![Download Windows EXE](https://img.shields.io/badge/Download-Windows%20EXE-blue?style=for-the-badge&logo=windows)](https://github.com/suja-labarum/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-win-x64.exe)

Local OCR is a desktop-first OCR tool for scanned PDFs with automatic unlock, Georgian OCR, and downloadable searchable output.

## Download

Download directly from the repository front page:

- macOS Apple Silicon `.dmg`: [Download Local OCR for macOS](https://github.com/suja-labarum/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-mac-arm64.dmg)
- macOS Apple Silicon `.zip`: [Download zipped macOS app](https://github.com/suja-labarum/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-mac-arm64.zip)
- Windows `.exe`: [Download Local OCR for Windows](https://github.com/suja-labarum/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-win-x64.exe)
- All release files: [Latest release page](https://github.com/suja-labarum/local-ocr-georgian-pdf/releases/latest)

Install `Docker Desktop` first:

- macOS / Windows: [Docker Desktop](https://www.docker.com/products/docker-desktop/)

The project now ships in two forms:

1. A native desktop wrapper for macOS and Windows.
2. The original local web backend, which the desktop app starts automatically.

Drop one PDF and the app will:

1. Try to remove encryption automatically.
2. Run `OCRmyPDF` with `Tesseract` Georgian OCR.
3. Download a searchable PDF.

## What Changed

This repository is no longer just a localhost Flask tool. It now includes:

- an Electron desktop app
- Windows installer build support
- macOS desktop build support
- GitHub Actions release automation for desktop artifacts

## Desktop Installers

Desktop builds are intended to be distributed through GitHub Releases.

Release artifacts:

- macOS: `.dmg` and `.zip`
- Windows: `.exe` installer

Important:

- The desktop app still depends on `Docker Desktop`.
- The app starts the OCR backend locally through Docker.
- This keeps the OCR stack identical across macOS and Windows without rewriting the OCR engine separately for each OS.

## End-User Install

### macOS

1. Install Docker Desktop.
2. Download the latest macOS release asset from GitHub Releases.
3. Open the app.
4. If macOS warns that the app is unsigned, allow it in System Settings and open it again.

If macOS says the app is "damaged", remove the quarantine flag and open it again:

```bash
xattr -dr com.apple.quarantine "/Applications/Local OCR.app"
```

If you opened it directly from Downloads instead of Applications, point the command at that copy instead.

### Windows

1. Install Docker Desktop.
2. Download the Windows `.exe` from the links at the top of this repository.
3. Open the app.
4. If Windows SmartScreen warns about an unsigned app, choose more info and run it anyway.

## Developer Quick Start

Clone the repository:

```bash
git clone https://github.com/suja-labarum/local-ocr-georgian-pdf.git
cd local-ocr-georgian-pdf
```

Install Node dependencies for the desktop shell:

```bash
npm install
```

Run the desktop app in development:

```bash
npm run desktop:dev
```

The desktop app will try to:

1. confirm Docker is available
2. run `docker compose up -d --build`
3. wait for the OCR backend
4. open the UI in a native window

## Local Backend Only

If you want to use the browser version without the desktop shell:

```bash
docker compose up --build
```

Then open:

[http://localhost:8765](http://localhost:8765)

## Build Desktop Installers

### macOS

```bash
npm run desktop:build:mac
```

### Windows

```bash
npm run desktop:build:win
```

### Output

Build artifacts are written to:

```text
dist/
```

## GitHub Release Flow

The repository includes a GitHub Actions workflow that builds desktop artifacts for macOS and Windows.

To create a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow will:

1. build macOS artifacts on `macos-latest`
2. build Windows artifacts on `windows-latest`
3. upload them to the GitHub release for that tag

Workflow file:

[.github/workflows/desktop-release.yml](/Users/tazo/Documents/Codex/2026-05-04/the-best-open-source-setup-for/.github/workflows/desktop-release.yml)

## Stack

- `Electron` for the desktop shell
- `Flask` for the local service
- `OCRmyPDF` for OCR orchestration
- `Tesseract OCR` with Georgian language data `kat`
- `qpdf` for decryption fallback and PDF inspection
- `pdfunlock` for open-source PDF unlocking
- `pdfrip` for advanced password recovery workflows
- `Docker` and `docker compose` for the backend runtime

## Features

- one-drop default flow: auto unlock + OCR
- Georgian OCR with `kat`
- mixed Georgian and English OCR with `kat+eng`
- blank-password encrypted PDF handling
- password field for protected PDFs
- advanced recovery tooling with `pdfrip`
- Claude-style warm desktop UI
- native desktop wrapper with backend startup handling

## Project Structure

```text
.
├── .github/workflows/desktop-release.yml
├── app.py
├── desktop/
│   ├── error.html
│   ├── loading.html
│   ├── main.js
│   └── preload.js
├── Dockerfile
├── docker-compose.yml
├── package.json
├── requirements.txt
├── templates/
│   └── index.html
└── README.md
```

## Notes

- The app runs entirely on the user's machine.
- Uploaded PDFs are processed in temporary directories.
- The desktop shell currently requires Docker Desktop instead of bundling OCR binaries directly into the installer.
- Windows builds are unsigned by default unless signing credentials are added later.
- macOS builds are not notarized by Apple unless Developer ID signing and notarization are added later.

## License

MIT
