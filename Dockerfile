FROM golang:1.24-bookworm AS pdfunlock-builder

RUN GOBIN=/out go install github.com/fadeltd/pdfunlock@main

FROM rust:1.88-bookworm AS pdfrip-builder

RUN cargo install --git https://github.com/mufeedvh/pdfrip.git --locked --root /out

FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    ocrmypdf \
    pngquant \
    qpdf \
    tesseract-ocr \
    tesseract-ocr-kat \
    unpaper \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --from=pdfunlock-builder /out/pdfunlock /usr/local/bin/pdfunlock
COPY --from=pdfrip-builder /out/bin/pdfrip /usr/local/bin/pdfrip

COPY app.py .
COPY templates ./templates

EXPOSE 8765

CMD ["python", "app.py"]
