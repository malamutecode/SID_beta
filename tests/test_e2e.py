"""End-to-end tests against a live LM Studio server.

These drive the full pipeline -- ingest a real sample PDF, send it to the model
via Pydantic AI, and assert the predicted category matches the expected label
from `samples/samples_description.md`.

They require LM Studio to be running and serving the configured model. If the
server is not reachable they are SKIPPED, so a normal `pytest` run is unaffected.

Run them explicitly with:

    uv run pytest -m e2e -v

Or run everything (basics + e2e if the server is up):

    uv run pytest -v
"""

from __future__ import annotations

import shutil
from pathlib import Path

import httpx
import pytest

from sid_beta.classifier import classify
from sid_beta.config import CATEGORIES, settings
from sid_beta.ingest import IngestError, ingest

SAMPLES_DIR = Path(__file__).resolve().parents[1] / "samples"


def _poppler_available() -> bool:
    """True if Poppler's pdftoppm can be found (PATH or configured poppler_path)."""
    if shutil.which("pdftoppm") is not None:
        return True
    if settings.poppler_path:
        return (Path(settings.poppler_path) / "pdftoppm.exe").exists()
    return False

# Expected file -> category, mirroring samples/samples_description.md.
EXPECTED: dict[str, str] = {
    "PB-2.pdf": "zgloszenia budowlane",
    "pcc-3-06-08.pdf": "podatki",
    "sd-3-06-015.pdf": "podatki",
    "pxx.pdf": "geodezja",
}


def _server_up() -> bool:
    """True if LM Studio's OpenAI-compatible API answers at the configured URL."""
    try:
        resp = httpx.get(f"{settings.base_url}/models", timeout=3.0)
        return resp.status_code == 200
    except Exception:
        return False


# Skip the whole module if the server is down -- keeps `pytest` green offline.
pytestmark = [
    pytest.mark.e2e,
    pytest.mark.skipif(not _server_up(), reason="LM Studio not reachable at SID_BASE_URL"),
]


def test_expected_labels_are_known_categories():
    """Guard: every expected label is part of the configured taxonomy."""
    unknown = set(EXPECTED.values()) - set(CATEGORIES)
    assert not unknown, f"expected labels not in CATEGORIES: {unknown}"


@pytest.mark.parametrize("filename, expected", sorted(EXPECTED.items()))
def test_sample_pdf_classified_correctly(filename: str, expected: str):
    path = SAMPLES_DIR / filename
    if not path.exists():
        pytest.skip(f"sample {filename} not present")

    try:
        payloads = ingest(path)
    except IngestError as exc:
        # Scanned PDFs need Poppler to rasterize; skip (don't fail) if it's
        # missing, so the suite distinguishes "missing system dep" from a
        # genuine misclassification.
        if not _poppler_available():
            pytest.skip(f"Poppler not installed; cannot rasterize {filename}: {exc}")
        raise

    result = classify(payloads)

    # Primary assertion: the predicted category must match the expected label.
    assert result.category == expected, (
        f"{filename}: expected {expected!r}, got {result.category!r} "
        f"(confidence {result.confidence:.2f}, reason: {result.reason})"
    )
    # Sanity on the structured output.
    assert 0.0 <= result.confidence <= 1.0
    assert result.reason.strip()
