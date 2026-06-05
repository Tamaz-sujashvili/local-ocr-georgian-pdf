# Local OCR

[![Download macOS DMG](https://img.shields.io/badge/Download-macOS%20DMG-black?style=for-the-badge&logo=apple)](https://github.com/Tamaz-sujashvili/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-mac-arm64.dmg)
[![Download macOS ZIP](https://img.shields.io/badge/Download-macOS%20ZIP-grey?style=for-the-badge&logo=apple)](https://github.com/Tamaz-sujashvili/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-mac-arm64.zip)
[![Download Windows EXE](https://img.shields.io/badge/Download-Windows%20EXE-blue?style=for-the-badge&logo=windows)](https://github.com/Tamaz-sujashvili/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-win-x64.exe)

**Local OCR** is one desktop application for scanned PDFs: automatic unlock when possible, Georgian OCR, and a searchable PDF download.

No Docker. No Python install. No terminal commands for normal use.

## Install (end users)

### macOS (Apple Silicon)

1. Download [Local-OCR-mac-arm64.dmg](https://github.com/Tamaz-sujashvili/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-mac-arm64.dmg).
2. Open the DMG and drag **Local OCR** into **Applications**.
3. Open **Local OCR** from Applications.
4. Drop a PDF and wait for the searchable download.

If macOS blocks the app:

```bash
xattr -dr com.apple.quarantine "/Applications/Local OCR.app"
codesign --force --deep --sign - "/Applications/Local OCR.app"
```

### Windows

1. Download [Local-OCR-win-x64.exe](https://github.com/Tamaz-sujashvili/local-ocr-georgian-pdf/releases/latest/download/Local-OCR-win-x64.exe).
2. Run the installer and launch **Local OCR**.
3. Drop a PDF and wait for the searchable download.

If SmartScreen appears, choose **More info** → **Run anyway** (installer is unsigned by default).

### All platforms

- [Latest release page](https://github.com/Tamaz-sujashvili/local-ocr-georgian-pdf/releases/latest) — DMG, ZIP, and EXE

## What is inside the app

Release installers ship a **built-in OCR engine** (Python, OCRmyPDF, Tesseract with Georgian `kat`, qpdf, Ghostscript, fonts, and helper tools). Everything runs locally on your computer.

| You get | You do **not** need |
|--------|---------------------|
| One app icon to open | Docker Desktop |
| Drag-and-drop PDF OCR | Homebrew / apt packages |
| Offline OCR after install | Manual `pip` or `conda` setup |
| Local-only processing | A web account or cloud upload |

**Developer mode** (`npm run desktop:dev`) can still download the engine on first run if you have not built a release installer. That path is for contributors only.

## How to use

1. Open **Local OCR**.
2. Drop a scanned PDF (or click to browse).
3. Optionally open **This PDF is password-protected** and enter the password.
4. Choose `kat` or `kat+eng` if needed.
5. The searchable PDF downloads automatically when processing finishes.

## Features

- Auto-unlock when a blank password works
- Manual password for protected PDFs
- Georgian OCR (`kat`) and mixed `kat+eng`
- Searchable PDF output
- Runs entirely on your machine; files stay local

## For developers

Clone the repo, install Node dependencies, and run the desktop shell:

```bash
git clone https://github.com/Tamaz-sujashvili/local-ocr-georgian-pdf.git
cd local-ocr-georgian-pdf
npm install
npm run desktop:dev
```

Build a **self-contained installer** (bundles the OCR engine into the app):

```bash
npm run desktop:build:mac   # macOS DMG + ZIP
npm run desktop:build:win   # Windows EXE
```

Artifacts are written to `dist/`. The build step runs `desktop/bundle-runtime.js` automatically so end users get a complete app.

Release tags (`v*`) trigger GitHub Actions to build macOS and Windows installers. See [.github/workflows/desktop-release.yml](.github/workflows/desktop-release.yml).

Optional legacy Docker setup for maintainers only: [legacy/docker/README.md](legacy/docker/README.md).

## Project layout

```text
.
├── app.py                 # Local Flask OCR service
├── desktop/               # Electron shell + runtime bootstrap
├── runtime/               # Conda environment + setup scripts
├── templates/             # App UI
└── legacy/docker/         # Optional maintainer Docker (not for end users)
```

## License

MIT
