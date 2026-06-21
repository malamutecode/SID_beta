"""Entrypoint: ingest the sample documents, classify each, and print results."""

from __future__ import annotations

from pathlib import Path

from pydantic_ai import BinaryContent

from .classifier import classify
from .config import settings
from .ingest import IngestError, Payload, ingest
from .samples import INLINE_SAMPLES

SAMPLES_DIR = Path(__file__).resolve().parents[2] / "samples"
SUPPORTED_SUFFIXES = {".pdf", ".png", ".jpg", ".jpeg", ".docx"}


def _payload_summary(payloads: list[Payload]) -> str:
    text_parts = sum(1 for p in payloads if isinstance(p, str))
    image_parts = sum(1 for p in payloads if isinstance(p, BinaryContent))
    bits = []
    if text_parts:
        bits.append(f"{text_parts} text")
    if image_parts:
        bits.append(f"{image_parts} image")
    return ", ".join(bits) or "empty"


def _preview(payloads: list[Payload], width: int = 120) -> str:
    for p in payloads:
        if isinstance(p, str):
            flat = " ".join(p.split())
            return flat[:width] + ("..." if len(flat) > width else "")
    return "(image payload — sent to the vision model)"


def _classify_and_print(source: str, payloads: list[Payload]) -> None:
    print(f"\n=== {source} ===")
    print(f"  payloads : {_payload_summary(payloads)}")
    print(f"  preview  : {_preview(payloads)}")
    try:
        result = classify(payloads)
    except Exception as exc:  # connection / model / parsing errors
        print(f"  ERROR    : classification failed: {exc}")
        return
    print(f"  category : {result.category}")
    print(f"  confidence: {result.confidence:.2f}")
    print(f"  reason   : {result.reason}")


def main() -> None:
    print(f"LM Studio: {settings.base_url}  (model: {settings.model_name})")

    files = sorted(
        p for p in SAMPLES_DIR.glob("*") if p.suffix.lower() in SUPPORTED_SUFFIXES
    )
    if not files:
        print(f"\nNo sample files found in {SAMPLES_DIR}")
    for path in files:
        try:
            payloads = ingest(path)
        except IngestError as exc:
            print(f"\n=== {path.name} ===")
            print(f"  SKIPPED  : {exc}")
            continue
        _classify_and_print(path.name, payloads)

    for label, text in INLINE_SAMPLES:
        _classify_and_print(label, [text])


if __name__ == "__main__":
    main()
