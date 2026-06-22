"""Performance e2e test: time classification per sample document.

Runs the full pipeline (ingest -> classify) against the live LM Studio model for
each sample and writes a plain-text report showing, per document:

  - number of pages
  - the kind of data ingested (text / image / mixed)
  - the text/image payload breakdown
  - wall-clock time to classify
  - predicted category

The report is written to `perf_report.txt` in the project root.

Requires LM Studio to be running (and Poppler for scanned PDFs). Skipped if the
server is unreachable, like the other e2e tests. Run with:

    uv run pytest -m e2e tests/test_perf_e2e.py -s -v
"""

from __future__ import annotations

import shutil
import time
from datetime import datetime
from pathlib import Path

import httpx
import pytest
from pydantic_ai import BinaryContent

from app.sid_beta.classifier import classify
from app.sid_beta.config import settings
from app.sid_beta.ingest import IngestError, Payload, ingest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SAMPLES_DIR = PROJECT_ROOT / "samples"
REPORT_PATH = PROJECT_ROOT / "perf_report.txt"

# Samples to measure (same set as the correctness e2e test).
SAMPLES = ["PB-2.pdf", "pcc-3-06-08.pdf", "sd-3-06-015.pdf", "pxx.pdf"]


def _server_up() -> bool:
    try:
        return httpx.get(f"{settings.base_url}/models", timeout=3.0).status_code == 200
    except Exception:
        return False


def _poppler_available() -> bool:
    if shutil.which("pdftoppm") is not None:
        return True
    if settings.poppler_path:
        return (Path(settings.poppler_path) / "pdftoppm.exe").exists()
    return False


pytestmark = [
    pytest.mark.e2e,
    pytest.mark.skipif(not _server_up(), reason="LM Studio not reachable at SID_BASE_URL"),
]


def _page_count(path: Path) -> int | None:
    """Number of pages for a PDF; None for non-PDF inputs."""
    if path.suffix.lower() != ".pdf":
        return None
    from pypdf import PdfReader

    return len(PdfReader(str(path)).pages)


def _data_kind(payloads: list[Payload]) -> tuple[str, int, int]:
    """Return (kind, text_parts, image_parts) for the ingested payloads."""
    text_parts = sum(1 for p in payloads if isinstance(p, str))
    image_parts = sum(1 for p in payloads if isinstance(p, BinaryContent))
    if text_parts and image_parts:
        kind = "mixed (text+image)"
    elif image_parts:
        kind = "image (scanned/VLM)"
    else:
        kind = "text"
    return kind, text_parts, image_parts


def test_classification_performance_report():
    rows: list[dict[str, object]] = []

    for name in SAMPLES:
        path = SAMPLES_DIR / name
        if not path.exists():
            continue

        pages = _page_count(path)
        try:
            payloads = ingest(path)
        except IngestError as exc:
            if not _poppler_available():
                rows.append(
                    {
                        "file": name,
                        "pages": pages,
                        "kind": "skipped (no Poppler)",
                        "text": 0,
                        "images": 0,
                        "seconds": None,
                        "category": "-",
                    }
                )
                continue
            raise

        kind, text_parts, image_parts = _data_kind(payloads)

        start = time.perf_counter()
        result = classify(payloads)
        elapsed = time.perf_counter() - start

        rows.append(
            {
                "file": name,
                "pages": pages,
                "kind": kind,
                "text": text_parts,
                "images": image_parts,
                "seconds": elapsed,
                "category": result.category,
            }
        )

    assert rows, "no samples measured"
    _write_report(rows)

    # Surface the report in the test output too.
    print(f"\nPerformance report written to {REPORT_PATH}")
    print(REPORT_PATH.read_text(encoding="utf-8"))


def _write_report(rows: list[dict[str, object]]) -> None:
    def fmt_pages(p: object) -> str:
        return "-" if p is None else str(p)

    def fmt_secs(s: object) -> str:
        return "-" if s is None else f"{s:.2f}"

    def fmt_per_page(row: dict[str, object]) -> str:
        secs, pages = row["seconds"], row["pages"]
        if secs is None or not isinstance(pages, int) or pages <= 0:
            return "-"
        return f"{secs / pages:.2f}"

    header = (
        f"{'File':<20} {'Pages':>5} {'Data type':<20} "
        f"{'Txt':>3} {'Img':>3} {'Time(s)':>8} {'s/page':>7}  Category"
    )
    sep = "-" * len(header)

    lines = [
        "Classification performance report",
        f"Generated: {datetime.now().isoformat(timespec='seconds')}",
        f"Model: {settings.model_name}   Endpoint: {settings.base_url}",
        f"Render DPI: {settings.pdf_render_dpi}   Max text chars: {settings.max_text_chars}",
        "",
        header,
        sep,
    ]

    measured = [r for r in rows if r["seconds"] is not None]
    for r in rows:
        lines.append(
            f"{str(r['file']):<20} {fmt_pages(r['pages']):>5} "
            f"{str(r['kind']):<20} {int(r['text']):>3} {int(r['images']):>3} "
            f"{fmt_secs(r['seconds']):>8} {fmt_per_page(r):>7}  {r['category']}"
        )

    lines.append(sep)
    if measured:
        times = [float(r["seconds"]) for r in measured]  # type: ignore[arg-type]
        total = sum(times)
        lines.append(
            f"Measured {len(measured)} document(s): "
            f"total {total:.2f}s, avg {total / len(measured):.2f}s, "
            f"min {min(times):.2f}s, max {max(times):.2f}s"
        )
    lines.append("")

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
