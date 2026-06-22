"""Configuration for the document-classification POC.

All tunable values (LM Studio connection, model name, and the document
taxonomy) live here so the rest of the app never hardcodes them. Values can be
overridden via environment variables / a `.env` file.
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Shared backend .env (this file is backend/app/sid_beta/config.py -> backend/.env).
# Absolute so it loads regardless of CWD (uv run, Docker WORKDIR).
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"

# The document taxonomy. Changing the set of categories should mean editing only
# this list (and it is what the classifier prompt is built from).
# Example classes taken from the sample PDFs in `samples/`.
CATEGORIES: list[str] = [
    "zgloszenia budowlane",  # building/construction notifications
    "podatki",  # taxes
    "umowa B2B",  # B2B contract
    "geodezja",  # surveying / geodesy
]


class Settings(BaseSettings):
    """Runtime settings, overridable via env vars (prefix ``SID_``) or ``.env``."""

    model_config = SettingsConfigDict(
        env_prefix="SID_",
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # LM Studio's OpenAI-compatible endpoint (default local server).
    base_url: str = "http://localhost:1234/v1"
    # Identifier of the model loaded in LM Studio. Must be a vision-language
    # model (e.g. Qwen3-VL / Gemma 3) for image input to work.
    model_name: str = "qwen/qwen3-vl-8b"
    # LM Studio does not require a real key; any placeholder works.
    api_key: str = "lm-studio"

    # If a PDF page yields fewer than this many extracted characters, treat it
    # as scanned and fall back to rasterizing + sending the image to the VLM.
    pdf_text_min_chars: int = 20

    # Cap on extracted text characters sent to the model per document. A
    # classifier only needs a representative excerpt, and this keeps requests
    # within smaller local context windows. 0 = no cap.
    max_text_chars: int = 6000

    # Optional path to Poppler's `bin` directory (the folder containing
    # pdftoppm). Only needed for scanned PDFs when Poppler is not on PATH.
    # Leave empty to rely on PATH.
    poppler_path: str = ""

    # Resolution (DPI) used when rasterizing scanned PDF pages to images. Lower
    # DPI = smaller images = fewer vision tokens (helps stay within the model's
    # context window); still legible for OCR by a capable VLM.
    pdf_render_dpi: int = 120


settings = Settings()
