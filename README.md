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
