# Local OCR

[![Download macOS DMG](https://img.shields.io/badge/Download-macOS%20DMG-black?style=for-the-badge&logo=apple)](https://github.com/suja-labarum/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-mac-arm64.dmg)
[![Download macOS ZIP](https://img.shields.io/badge/Download-macOS%20ZIP-grey?style=for-the-badge&logo=apple)](https://github.com/suja-labarum/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-mac-arm64.zip)
[![Download Windows EXE](https://img.shields.io/badge/Download-Windows%20EXE-blue?style=for-the-badge&logo=windows)](https://github.com/suja-labarum/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-win-x64.exe)

Local OCR is a desktop OCR app for scanned PDFs with automatic unlock, Georgian OCR, and downloadable searchable output.

This release line no longer requires Docker Desktop. The app now bootstraps its own OCR runtime locally on first launch.

## Download

- macOS Apple Silicon `.dmg`: [Download Local OCR for macOS](https://github.com/suja-labarum/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-mac-arm64.dmg)
- macOS Apple Silicon `.zip`: [Download zipped macOS app](https://github.com/suja-labarum/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-mac-arm64.zip)
- Windows `.exe`: [Download Local OCR for Windows](https://github.com/suja-labarum/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-win-x64.exe)
- All release files: [Latest release page](https://github.com/suja-labarum/local-ocr-georgian-pdf/releases/latest)

## How It Works

Drop one PDF and the app will:

1. Try to remove encryption automatically.
2. Run `OCRmyPDF` with `Tesseract` Georgian OCR.
3. Download a searchable PDF.

On first launch, the desktop app downloads and prepares its own local runtime using `micromamba` and `conda-forge`. That runtime includes:

- `python`
- `flask`
- `ocrmypdf`
- `tesseract`
- `qpdf`
- `ghostscript`
- `font-ttf-noto`

No Docker Desktop is required.
The desktop release is self-contained for automatic unlock + OCR. Advanced password-recovery tooling is not required for the normal app flow.

## End-User Install

### macOS

1. Download the latest macOS `.dmg` from the links above.
2. Move `Local OCR.app` into `Applications`.
3. Open the app.
4. On the first launch, wait while the OCR runtime installs locally.

If macOS says the app is "damaged", remove the quarantine flag and open it again:

```bash
xattr -dr com.apple.quarantine "/Applications/Local OCR.app"
```

If the app still refuses to open after download/extraction, re-sign it locally and retry:

```bash
codesign --force --deep --sign - "/Applications/Local OCR.app"
```

### Windows

1. Download the latest Windows `.exe` from the links above.
2. Open the installer.
3. Launch the app.
4. On the first launch, wait while the OCR runtime installs locally.

If Windows SmartScreen warns about an unsigned app, choose more info and run it anyway.

## What Changed

This repository now ships Local OCR as a self-bootstrapping desktop app:

- Electron desktop shell
- built-in runtime bootstrap with `micromamba`
- local Python OCR stack via `conda-forge`
- macOS and Windows installer builds
- GitHub Actions release automation for desktop artifacts

## Developer Quick Start

```bash
git clone https://github.com/suja-labarum/local-ocr-georgian-pdf.git
cd local-ocr-georgian-pdf
npm install
npm run desktop:dev
```

The first run will download and create the local OCR runtime automatically.

## Build Desktop Installers

### macOS

```bash
npm run desktop:build:mac
```

### Windows

```bash
npm run desktop:build:win
```

Build artifacts are written to:

```text
dist/
```

## GitHub Release Flow

To create a release:

```bash
git tag v1.1.2
git push origin v1.1.2
```

The GitHub Actions workflow builds:

1. macOS artifacts on `macos-latest`
2. Windows artifacts on `windows-latest`
3. release assets attached to the tag

Workflow file:

[.github/workflows/desktop-release.yml](.github/workflows/desktop-release.yml)

## Stack

- `Electron` for the desktop shell
- `Flask` for the local service
- `micromamba` for local runtime bootstrap
- `conda-forge` packages for OCR dependencies
- `OCRmyPDF` for OCR orchestration
- `Tesseract OCR` with Georgian language data `kat`
- `qpdf` for decryption fallback and PDF inspection

## Features

- one-drop default flow: auto unlock + OCR
- Georgian OCR with `kat`
- mixed Georgian and English OCR with `kat+eng`
- blank-password encrypted PDF handling
- password field for protected PDFs
- no Docker requirement
- Claude-style warm desktop UI
- native desktop wrapper with local runtime startup handling

## Project Structure

```text
.
├── .github/workflows/desktop-release.yml
├── app.py
├── desktop/
│   ├── after-pack.js
│   ├── error.html
│   ├── loading.html
│   ├── main.js
│   └── preload.js
├── package.json
├── runtime/
│   └── environment.yml
├── templates/
│   └── index.html
└── README.md
```

## Notes

- The app runs entirely on the user's machine.
- Uploaded PDFs are processed in temporary directories.
- The first launch can take several minutes because the OCR runtime is downloaded and installed locally.
- Runtime installation retries slow package downloads automatically and reuses the local package cache.
- Windows builds are unsigned by default unless signing credentials are added later.
- macOS builds are not notarized by Apple unless Developer ID signing and notarization are added later.

## License

MIT
