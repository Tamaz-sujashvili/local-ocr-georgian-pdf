#!/usr/bin/env python3
"""Install optional desktop helper binaries (pdfrip) into the runtime tools directory."""

from __future__ import annotations

import os
import platform
import shutil
import stat
import subprocess
import sys
import urllib.request
from pathlib import Path

PDFRIP_VERSION = "v3.0.0"
PDFRIP_BASE_URL = f"https://github.com/mufeedvh/pdfrip/releases/download/{PDFRIP_VERSION}"


def resolve_platform_asset() -> tuple[str, str] | None:
    system = sys.platform
    machine = platform.machine().lower()

    if system == "darwin":
        return ("pdfrip_darwin", "pdfrip")
    if system == "win32":
        return ("pdfrip.exe", "pdfrip.exe")
    if system == "linux" and machine in {"x86_64", "amd64"}:
        return ("pdfrip_amd64", "pdfrip")

    return None


def download_pdfrip(tools_dir: Path) -> None:
    asset = resolve_platform_asset()
    if asset is None:
        print(
            "Skipping pdfrip install: no prebuilt binary for this platform.",
            flush=True,
        )
        return

    asset_name, binary_name = asset
    destination = tools_dir / binary_name
    if destination.exists() and destination.stat().st_size > 0:
        return

    tools_dir.mkdir(parents=True, exist_ok=True)
    url = f"{PDFRIP_BASE_URL}/{asset_name}"
    temp_path = tools_dir / f".{asset_name}.download"

    print(f"Downloading pdfrip ({asset_name})...", flush=True)
    urllib.request.urlretrieve(url, temp_path)
    shutil.move(temp_path, destination)

    if sys.platform != "win32":
        destination.chmod(destination.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def ensure_pdfunlock(tools_dir: Path) -> None:
    binary_name = "pdfunlock.exe" if sys.platform == "win32" else "pdfunlock"
    destination = tools_dir / binary_name
    if destination.exists() and destination.stat().st_size > 0:
        return

    go = shutil.which("go")
    if not go:
        print("Skipping pdfunlock install: go is not available.", flush=True)
        return

    tools_dir.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["GOBIN"] = str(tools_dir)

    print("Building pdfunlock...", flush=True)
    subprocess.run(
        [go, "install", "github.com/fadeltd/pdfunlock@latest"],
        env=env,
        check=True,
    )


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: ensure_optional_tools.py <tools-dir>", file=sys.stderr)
        return 2

    tools_dir = Path(sys.argv[1])
    download_pdfrip(tools_dir)
    ensure_pdfunlock(tools_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
