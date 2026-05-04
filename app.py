from __future__ import annotations

import os
import errno
import json
import pty
import select
import shutil
import subprocess
import tempfile
from pathlib import Path

from flask import Flask, Response, render_template, request, send_file
from werkzeug.utils import secure_filename


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024

DEFAULT_LANG = "kat"
DEFAULT_ACTION = "ocr"
DEFAULT_RECOVER_METHOD = "default-query"


def decrypt_pdf_with_pdfunlock(input_pdf: Path, output_pdf: Path, password: str) -> None:
    master_fd, slave_fd = pty.openpty()
    cmd = ["pdfunlock", str(input_pdf), str(output_pdf)]
    process = None

    try:
        process = subprocess.Popen(
            cmd,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            text=False,
            close_fds=True,
        )
    finally:
        os.close(slave_fd)

    output = bytearray()
    os.write(master_fd, password.encode("utf-8") + b"\n")

    try:
        while True:
            ready, _, _ = select.select([master_fd], [], [], 0.2)
            if ready:
                try:
                    chunk = os.read(master_fd, 4096)
                except OSError as exc:
                    if exc.errno == errno.EIO:
                        break
                    raise
                if chunk:
                    output.extend(chunk)
                elif process.poll() is not None:
                    break

            if process.poll() is not None and not ready:
                break
    finally:
        os.close(master_fd)

    return_code = process.wait()
    if return_code != 0:
        raise subprocess.CalledProcessError(
            return_code,
            cmd,
            output=bytes(output).decode("utf-8", errors="replace"),
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

    completed = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=False,
    )

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


@app.get("/")
def index() -> str:
    return render_template(
        "index.html",
        default_lang=DEFAULT_LANG,
        default_action=DEFAULT_ACTION,
        default_recover_method=DEFAULT_RECOVER_METHOD,
    )


@app.post("/convert")
def convert() -> Response:
    upload = request.files.get("pdf")
    if not upload or not upload.filename:
        return Response("No PDF file was uploaded.", status=400)

    filename = secure_filename(upload.filename)
    if not filename.lower().endswith(".pdf"):
        return Response("Only PDF files are accepted.", status=400)

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

        if action != "recover":
            decrypted_pdf = temp_path / f"{input_pdf.stem}.decrypted.pdf"
            try:
                decrypt_pdf(input_pdf, decrypted_pdf, password)
            except subprocess.CalledProcessError as exc:
                message = (
                    getattr(exc, "stderr", "") or getattr(exc, "stdout", "") or str(exc)
                ).strip()
                if password:
                    hint = "The provided password did not unlock the PDF."
                else:
                    hint = "This PDF requires a non-empty password. Provide it in the password field or use recovery mode."
                return Response(
                    f"PDF decryption failed.\n\n{hint}\n\n{message}",
                    status=400,
                    mimetype="text/plain",
                )
            working_pdf = decrypted_pdf
        if action == "decrypt":
            download_name = f"{input_pdf.stem}.decrypted.pdf"
            final_output = temp_path / f"download-{download_name}"
            shutil.copy2(working_pdf, final_output)

            return send_file(
                final_output,
                as_attachment=True,
                download_name=download_name,
                mimetype="application/pdf",
            )

        output_pdf = temp_path / f"{input_pdf.stem}.ocr.pdf"

        try:
            run_ocr(working_pdf, output_pdf, language)
        except subprocess.CalledProcessError as exc:
            message = exc.stderr.strip() or exc.stdout.strip() or str(exc)
            return Response(f"OCR failed:\n\n{message}", status=500, mimetype="text/plain")

        download_name = output_pdf.name
        final_output = temp_path / f"download-{download_name}"
        shutil.copy2(output_pdf, final_output)

        return send_file(
            final_output,
            as_attachment=True,
            download_name=download_name,
            mimetype="application/pdf",
        )


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8765")),
        debug=False,
    )
