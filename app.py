from __future__ import annotations

import os
import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import quote

from flask import Flask, Response, jsonify, render_template, request, send_file


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024

DEFAULT_LANG = "kat"
DEFAULT_ACTION = "ocr"
DEFAULT_RECOVER_METHOD = "default-query"


def safe_upload_filename(original: str) -> str:
    """Keep Unicode filenames (e.g. Georgian) while blocking path traversal."""
    name = Path(original).name.replace("\x00", "")
    name = name.replace("/", "_").replace("\\", "_").strip().strip(".")
    if not name:
        return "upload.pdf"
    if not name.lower().endswith(".pdf"):
        return f"{name}.pdf"
    return name


def output_download_name(stem: str, suffix: str) -> str:
    cleaned = stem.strip().strip(".") or "document"
    return f"{cleaned}{suffix}"


def build_content_disposition(download_name: str, fallback: str) -> str:
    # Strip non-ASCII from the full name, then re-derive stem/suffix safely.
    ascii_only = download_name.encode("ascii", "ignore").decode("ascii")
    ascii_filename = Path(ascii_only).name.strip().strip(".") or fallback or "document.pdf"
    utf8_name = quote(download_name, safe="")
    return f"attachment; filename=\"{ascii_filename}\"; filename*=UTF-8''{utf8_name}"


def send_pdf(path: Path, download_name: str, fallback: str = "document.pdf") -> Response:
    response = send_file(path, as_attachment=False, mimetype="application/pdf")
    response.headers["Content-Disposition"] = build_content_disposition(download_name, fallback)
    return response


def decrypt_pdf_with_pdfunlock(input_pdf: Path, output_pdf: Path, password: str) -> None:
    cmd = ["pdfunlock", str(input_pdf), str(output_pdf)]
    subprocess.run(
        cmd,
        input=f"{password}\n",
        text=True,
        check=True,
        capture_output=True,
    )


def decrypt_pdf_with_qpdf(input_pdf: Path, output_pdf: Path, password: str) -> None:
    cmd = [
        "qpdf",
        "--decrypt",
        f"--password={password}",
        str(input_pdf),
        str(output_pdf),
    ]

    subprocess.run(cmd, check=True, capture_output=True, text=True)


def pdf_is_encrypted(input_pdf: Path) -> bool:
    completed = subprocess.run(
        ["qpdf", "--show-encryption", str(input_pdf)],
        capture_output=True,
        text=True,
        check=False,
    )
    output = f"{completed.stdout}\n{completed.stderr}".lower()
    return "not encrypted" not in output


def prepare_working_pdf(
    input_pdf: Path,
    decrypted_pdf: Path,
    password: str,
) -> Path:
    if not pdf_is_encrypted(input_pdf):
        return input_pdf

    decrypt_pdf(input_pdf, decrypted_pdf, password)
    return decrypted_pdf


def decrypt_pdf(input_pdf: Path, output_pdf: Path, password: str) -> None:
    if password == "":
        decrypt_pdf_with_qpdf(input_pdf, output_pdf, password)
        return

    try:
        decrypt_pdf_with_pdfunlock(input_pdf, output_pdf, password)
    except FileNotFoundError:
        decrypt_pdf_with_qpdf(input_pdf, output_pdf, password)


def run_ocr(input_pdf: Path, output_pdf: Path, language: str) -> None:
    cmd = [
        "ocrmypdf",
        "--pdf-renderer",
        "sandwich",
        "--language",
        language,
        "--deskew",
        "--rotate-pages",
        "--skip-text",
        "--optimize",
        "1",
        str(input_pdf),
        str(output_pdf),
    ]

    subprocess.run(cmd, check=True, capture_output=True, text=True)


def repair_pdf(input_pdf: Path, output_pdf: Path) -> bool:
    cmd = [
        "qpdf",
        str(input_pdf),
        str(output_pdf),
    ]

    completed = subprocess.run(cmd, check=False, capture_output=True, text=True)
    return completed.returncode in {0, 3} and output_pdf.exists()


def recover_pdf_password_with_pdfrip(
    input_pdf: Path,
    args: list[str],
) -> dict:
    cmd = [
        "pdfrip",
        "--json",
        "--threads",
        "1",
        "--user-password-only",
        "--file",
        str(input_pdf),
    ] + args

    try:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            "Password recovery requires pdfrip, which is not installed on this system. "
            "Restart the app to download it, or provide the PDF password directly."
        ) from exc

    stdout = completed.stdout.strip()
    stderr = completed.stderr.strip()

    if not stdout:
        message = stderr or f"pdfrip exited with code {completed.returncode}"
        raise RuntimeError(message)

    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(stderr or stdout) from exc

    payload["_returncode"] = completed.returncode
    return payload


def get_icon_path() -> Path | None:
    base = Path(__file__).resolve().parent
    for candidate in (
        base / "assets" / "icons" / "icon.png",
        base.parent / "assets" / "icons" / "icon.png",
    ):
        if candidate.exists():
            return candidate
    return None


@app.get("/favicon.ico")
def favicon() -> Response:
    icon_path = get_icon_path()
    if not icon_path:
        return Response(status=404)
    return send_file(icon_path, mimetype="image/png")


@app.get("/")
def index() -> str:
    return render_template(
        "index.html",
        default_lang=DEFAULT_LANG,
        default_action=DEFAULT_ACTION,
        default_recover_method=DEFAULT_RECOVER_METHOD,
    )


@app.get("/healthz")
def healthcheck() -> Response:
    return jsonify({"status": "ok"})


@app.post("/convert")
def convert() -> Response:
    upload = request.files.get("pdf")
    if not upload or not upload.filename:
        return Response("No PDF file was uploaded.", status=400)

    if not upload.filename.lower().endswith(".pdf"):
        return Response("Only PDF files are accepted.", status=400)

    original_stem = Path(upload.filename).stem
    filename = safe_upload_filename(upload.filename)

    action = request.form.get("action", DEFAULT_ACTION).strip() or DEFAULT_ACTION
    language = request.form.get("language", DEFAULT_LANG).strip() or DEFAULT_LANG
    password = request.form.get("password", "")
    recover_method = (
        request.form.get("recover_method", DEFAULT_RECOVER_METHOD).strip()
        or DEFAULT_RECOVER_METHOD
    )
    recover_min_length = request.form.get("recover_min_length", "1").strip() or "1"
    recover_max_length = request.form.get("recover_max_length", "4").strip() or "4"
    recover_range_start = request.form.get("recover_range_start", "").strip()
    recover_range_end = request.form.get("recover_range_end", "").strip()
    recover_date_start = request.form.get("recover_date_start", "").strip()
    recover_date_end = request.form.get("recover_date_end", "").strip()
    recover_date_format = request.form.get("recover_date_format", "DDMMYYYY").strip() or "DDMMYYYY"
    recover_mask = request.form.get("recover_mask", "").strip()
    recover_custom_query = request.form.get("recover_custom_query", "").strip()
    recover_add_zeros = request.form.get("recover_add_zeros") == "on"

    if action not in {"ocr", "decrypt", "recover"}:
        return Response("Invalid action.", status=400)

    with tempfile.TemporaryDirectory(prefix="ocr-input-") as temp_dir:
        temp_path = Path(temp_dir)
        input_pdf = temp_path / filename
        upload.save(input_pdf)
        working_pdf = input_pdf

        if action == "recover":
            if recover_method not in {"default-query", "range", "date", "mask", "custom-query"}:
                return Response(
                    "Invalid recover method.",
                    status=400,
                    mimetype="text/plain",
                )

            try:
                if recover_method == "default-query":
                    min_length = int(recover_min_length)
                    max_length = int(recover_max_length)
                    if min_length < 0 or max_length < 0 or min_length > max_length:
                        raise ValueError
                    recover_args = [
                        "default-query",
                        "--min-length",
                        str(min_length),
                        "--max-length",
                        str(max_length),
                    ]
                elif recover_method == "range":
                    start = int(recover_range_start)
                    end = int(recover_range_end)
                    if start > end:
                        raise ValueError
                    recover_args = [
                        "range",
                        str(start),
                        str(end),
                    ]
                    if recover_add_zeros:
                        recover_args.append("--add-preceding-zeros")
                elif recover_method == "date":
                    start = int(recover_date_start)
                    end = int(recover_date_end)
                    if start > end:
                        raise ValueError
                    recover_args = [
                        "date",
                        "--format",
                        recover_date_format,
                        str(start),
                        str(end),
                    ]
                elif recover_method == "mask":
                    if not recover_mask:
                        raise ValueError
                    recover_args = ["mask", recover_mask]
                else:
                    if not recover_custom_query:
                        raise ValueError
                    recover_args = ["custom-query", recover_custom_query]
                    if recover_add_zeros:
                        recover_args.append("--add-preceding-zeros")
            except ValueError:
                return Response(
                    "Recover mode parameters are invalid for the selected method.",
                    status=400,
                    mimetype="text/plain",
                )

            try:
                result = recover_pdf_password_with_pdfrip(
                    input_pdf,
                    recover_args,
                )
            except RuntimeError as exc:
                return Response(
                    f"Password recovery failed.\n\n{exc}",
                    status=500,
                    mimetype="text/plain",
                )

            result_name = f"{input_pdf.stem}.pdfrip.json"
            result_path = temp_path / result_name
            result_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

            return send_file(
                result_path,
                as_attachment=True,
                download_name=result_name,
                mimetype="application/json",
            )

        decrypted_pdf = temp_path / f"{input_pdf.stem}.decrypted.pdf"
        try:
            working_pdf = prepare_working_pdf(input_pdf, decrypted_pdf, password)
        except subprocess.CalledProcessError as exc:
            message = (
                getattr(exc, "stderr", "") or getattr(exc, "stdout", "") or str(exc)
            ).strip()
            if password:
                hint = "The provided password did not unlock the PDF."
            else:
                hint = (
                    "This PDF requires a non-empty password. Provide it in the "
                    "password field or use recovery mode."
                )
            return Response(
                f"PDF decryption failed.\n\n{hint}\n\n{message}",
                status=400,
                mimetype="text/plain",
            )
        if action == "decrypt":
            download_name = output_download_name(original_stem, ".decrypted.pdf")
            final_output = temp_path / f"download-{download_name}"
            shutil.copy2(working_pdf, final_output)
            return send_pdf(final_output, download_name, "document.decrypted.pdf")

        output_pdf = temp_path / f"{input_pdf.stem}.ocr.pdf"

        try:
            run_ocr(working_pdf, output_pdf, language)
        except subprocess.CalledProcessError as exc:
            repaired_pdf = temp_path / f"{input_pdf.stem}.ocr.repaired.pdf"
            if output_pdf.exists() and repair_pdf(output_pdf, repaired_pdf):
                output_pdf = repaired_pdf
            else:
                message = exc.stderr.strip() or exc.stdout.strip() or str(exc)
                return Response(f"OCR failed:\n\n{message}", status=500, mimetype="text/plain")

        download_name = output_download_name(original_stem, ".ocr.pdf")
        final_output = temp_path / f"download-{download_name}"
        shutil.copy2(output_pdf, final_output)

        return send_pdf(final_output, download_name, "document.ocr.pdf")


if __name__ == "__main__":
    app.run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8765")),
        debug=False,
    )
