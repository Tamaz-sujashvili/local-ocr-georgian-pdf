# Local OCR

Local OCR is a Dockerized local web app for turning scanned PDFs into searchable PDFs.
Drop one file into the browser UI and the app will:

1. Try to remove PDF encryption automatically.
2. Run `OCRmyPDF` with `Tesseract` Georgian OCR.
3. Download a searchable PDF back to the browser.

The interface is single-page, local-first, and designed for one-step use on desktop.

## Stack

- `OCRmyPDF` for PDF OCR orchestration
- `Tesseract OCR` with Georgian language data `kat`
- `qpdf` for decryption fallback and PDF inspection
- `pdfunlock` for open-source PDF unlocking
- `pdfrip` for advanced password recovery workflows
- `Flask` for the local web server
- `Docker` and `docker compose` for install-and-run packaging

## Features

- One-drop default flow: auto unlock + OCR
- Georgian OCR with `kat`
- Mixed Georgian and English OCR with `kat+eng`
- Blank-password encrypted PDF handling
- Password field for protected PDFs
- Optional password recovery tooling with `pdfrip`
- Single self-contained HTML front end with light and dark themes

## Requirements

- Docker
- Docker Compose

## Quick Start

```bash
git clone https://github.com/suja-labarum/local-ocr-georgian-pdf.git
cd local-ocr-georgian-pdf
docker compose up --build
```

Open:

[http://localhost:8765](http://localhost:8765)

## Free Hosting

This app is not suitable for GitHub Pages because GitHub Pages only hosts static files, while Local OCR needs a running Python server and OCR binaries. GitHub's docs describe Pages as a static hosting service.

### Option 1: Hugging Face Spaces

This is the easiest free public deployment path for this project because official Spaces docs support Docker apps, and the Spaces overview currently lists `CPU Basic` as free with `2 vCPU`, `16 GB` RAM, and `50 GB` ephemeral disk.

1. Create a new Space on Hugging Face.
2. Choose `Docker` as the SDK.
3. Push this repository to the Space repository.
4. Add this YAML block at the top of the Space `README.md`:

```yaml
---
title: Local OCR
emoji: 📄
colorFrom: orange
colorTo: red
sdk: docker
app_port: 8765
---
```

5. Let the Space build the existing `Dockerfile`.

Notes:

- Free Spaces can sleep when idle.
- Disk is not persistent, which is fine for this app because uploads are temporary.
- Public uploads go through a third-party host, so this is not ideal for sensitive PDFs.

### Option 2: Google Cloud Run

Cloud Run is more production-like. Official Google Cloud docs currently show an always-free tier for Cloud Run, but it still requires a Google Cloud project and billing setup.

1. Install the Google Cloud CLI.
2. Authenticate:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

3. Build and submit the container:

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/local-ocr
```

4. Deploy it publicly:

```bash
gcloud run deploy local-ocr \
  --image gcr.io/YOUR_PROJECT_ID/local-ocr \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

Notes:

- I updated the app to honor the `PORT` environment variable, which Cloud Run expects.
- You may still get charges if usage goes beyond the free tier.
- This is the better option if you want a stable URL and later add a custom domain.

## Usage

### Standard OCR

1. Open the app in your browser.
2. Drop a scanned PDF into the upload card.
3. If the PDF needs a real password, expand the password field and enter it.
4. The app will unlock the PDF when possible, run OCR, and start the download automatically.

### OCR Languages

- `kat` for Georgian documents
- `kat+eng` for mixed Georgian and English documents

### Decrypt Only

The backend also supports decrypt-only mode, which returns a cleaned PDF without OCR. This is available through the `/convert` endpoint for local integrations.

### Password Recovery

`pdfrip` is included for advanced recovery workflows. Supported strategies:

- `default-query`
- `range`
- `date`
- `mask`
- `custom-query`

These are useful when a PDF cannot be opened automatically and you need structured recovery options.

## Project Structure

```text
.
├── app.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── templates/
│   └── index.html
└── README.md
```

## Notes

- The app runs entirely on your machine.
- Uploaded files are processed in temporary directories inside the container.
- The UI is optimized for desktop but remains usable down to tablet widths.
- The default port is `8765`.

## Development

Run locally with Docker:

```bash
docker compose up --build
```

Stop the app:

```bash
docker compose down
```

## License

MIT
