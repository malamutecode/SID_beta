"""Simple LLM-free tests: output schema validation + ingestion dispatch.

These do not require LM Studio to be running.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError
from pydantic_ai import BinaryContent

from sid_beta.config import CATEGORIES
from sid_beta.ingest import IngestError, ingest
from sid_beta.models import Classification

SAMPLES_DIR = Path(__file__).resolve().parents[1] / "samples"


def test_classification_accepts_known_category():
    result = Classification(category=CATEGORIES[0], confidence=0.9, reason="ok")
    assert result.category == CATEGORIES[0]


def test_classification_normalises_case():
    result = Classification(
        category=CATEGORIES[0].upper(), confidence=0.5, reason="case-insensitive"
    )
    assert result.category == CATEGORIES[0]


def test_classification_rejects_unknown_category():
    with pytest.raises(ValidationError):
        Classification(category="definitely-not-a-category", confidence=0.5, reason="x")


def test_classification_rejects_out_of_range_confidence():
    with pytest.raises(ValidationError):
        Classification(category=CATEGORIES[0], confidence=1.5, reason="too high")


def test_ingest_rejects_legacy_doc(tmp_path):
    doc = tmp_path / "old.doc"
    doc.write_bytes(b"not really a doc")
    with pytest.raises(IngestError, match="convert to PDF"):
        ingest(doc)


def test_ingest_rejects_unsupported_type(tmp_path):
    other = tmp_path / "data.xyz"
    other.write_text("hello")
    with pytest.raises(IngestError, match="unsupported"):
        ingest(other)


def test_ingest_missing_file(tmp_path):
    with pytest.raises(IngestError, match="not a file"):
        ingest(tmp_path / "nope.pdf")


@pytest.mark.parametrize(
    "name", ["PB-2.pdf", "pcc-3-06-08.pdf", "sd-3-06-015.pdf"]
)
def test_ingest_sample_pdfs(name):
    path = SAMPLES_DIR / name
    if not path.exists():
        pytest.skip(f"sample {name} not present")
    payloads = ingest(path)
    assert payloads, "expected at least one payload"
    # Each payload is either extracted text or an image for the vision model.
    assert all(isinstance(p, (str, BinaryContent)) for p in payloads)
