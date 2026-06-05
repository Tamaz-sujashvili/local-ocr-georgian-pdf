#!/usr/bin/env python3
"""Download kat/eng tessdata into the desktop OCR runtime when missing."""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

TESSDATA_URLS = {
    "eng": "https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata",
    "kat": "https://github.com/tesseract-ocr/tessdata_fast/raw/main/kat.traineddata",
}


def resolve_tessdata_dir(env_prefix: Path) -> Path:
    candidates = [
        env_prefix / "share" / "tessdata",
        env_prefix / "share" / "tesseract" / "tessdata",
        env_prefix / "Library" / "share" / "tessdata",
        env_prefix / "Library" / "share" / "tesseract" / "tessdata",
    ]

    for candidate in candidates:
        if candidate.is_dir():
            return candidate

    default = candidates[0]
    default.mkdir(parents=True, exist_ok=True)
    return default


def ensure_language_pack(tessdata_dir: Path, language: str, url: str) -> None:
    destination = tessdata_dir / f"{language}.traineddata"
    if destination.exists() and destination.stat().st_size > 0:
        return

    print(f"Downloading {language} tessdata...", flush=True)
    urllib.request.urlretrieve(url, destination)


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: ensure_tessdata.py <conda-env-prefix>", file=sys.stderr)
        return 2

    env_prefix = Path(sys.argv[1])
    if not env_prefix.is_dir():
        print(f"Runtime prefix does not exist: {env_prefix}", file=sys.stderr)
        return 1

    tessdata_dir = resolve_tessdata_dir(env_prefix)
    for language, url in TESSDATA_URLS.items():
        ensure_language_pack(tessdata_dir, language, url)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
