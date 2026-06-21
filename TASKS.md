# TASKS — Document Classification POC

Goal: a minimal Pydantic AI app that classifies **document files** — `.pdf`
(text and scanned/image-only, the **primary** format), `.docx`, images (`.png`,
`.jpg`/`.jpeg`), plus inline text — into configurable categories using LM
Studio, returning structured output (category + confidence + reason). Native
text (`.docx`, text PDFs, inline) is extracted to text; images and scanned PDF
pages are sent **directly to a vision model** (VLM does the OCR — no Tesseract).

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

## 1. Project scaffold (uv)
- [x] `uv init` the project and pin Python 3.13 (`.python-version`)
- [x] Add deps: `uv add "pydantic-ai-slim[openai]" pydantic-settings python-dotenv`
- [x ] Create `src/sid_beta/` package layout (see CLAUDE.md)
- [x] `uv sync` and confirm the venv builds
- [x] Add ingestion deps: `uv add python-docx pypdf pdf2image pillow`
- [ ] Install **Poppler** on PATH (for `pdf2image`, scanned PDFs only — no Tesseract)
- [ ] Load a **vision model** (Qwen3-VL / Gemma 3) in LM Studio and confirm it
      serves image input over the OpenAI-compatible API

## 2. Configuration
- [x] `config.py`: settings for `base_url` (default `http://localhost:1234/v1`),
      `model_name`, `api_key` placeholder — loaded from env with sensible defaults
- [x] Define `CATEGORIES` list in one place (the document taxonomy)
- [x] `.env.example` documenting the configurable values

## 3. Output schema
- [x] `models.py`: `Classification` pydantic model
      (`category`, `confidence: float`, `reason: str`)
- [x] Constrain `category` to the configured categories (validator vs. CATEGORIES)

## 4. Document ingestion (file → text or image payloads)
- [x] `ingest.py`: `ingest(path) -> list[str | BinaryContent]` dispatching on extension
      (text payload = extracted string; image payload = `BinaryContent` bytes)
- [x] `.pdf` text → text via `pypdf`  **(primary path — do this first)**
- [x] `.pdf` scanned: if a page has little/no text, rasterize via
      `pdf2image`/Poppler → emit page image as `BinaryContent` (VLM does OCR)
- [x] Images (`.png`/`.jpg`/`.jpeg`) → `BinaryContent` with the right `media_type`
- [x] `.docx` → text via `python-docx` (paragraphs + tables)
- [x] `.doc` (legacy): **skipped for now** — raise a clear "convert to PDF" error
- [x] Raise a clear error for unsupported types and for missing Poppler

## 5. Classifier
- [x] `classifier.py`: build `OpenAIChatModel` + `OpenAIProvider` pointed at LM Studio
- [x] Create `Agent(model, output_type=Classification)` with a system prompt that
      lists the allowed categories and the required output shape
- [x] `classify(payloads: list[str | BinaryContent]) -> Classification` — pass the
      prompt plus ingested payloads to `agent.run_sync([...])`

## 6. Samples + entrypoint
- [x] Sample PDFs present in `samples/` (PB-2, pcc-3, sd-3 — all text PDFs)
- [x] `samples.py`: a few inline document text samples (varied categories)
- [x] `main.py`: ingest each file in `samples/` (+ inline samples) → classify →
      pretty-print results (source → payload kind/preview → result)
- [x] Basic error handling: clear message if LM Studio isn't reachable, and if
      a file fails to extract (skip + report, don't crash the run)
- [x] Simple LLM-free tests (`tests/test_basics.py`): schema + ingestion — 10 pass

## 7. Run & validate
- [x] LM Studio running, serving `qwen/qwen3-vl-8b` (now the default model)
- [x] e2e tests (`tests/test_e2e.py`, `-m e2e`): ingest sample PDFs → classify →
      assert against expected labels. Auto-skip if server down / Poppler missing
- [x] Text-PDF path verified end-to-end: PB-2, pcc-3, sd-3 classified correctly
      by the live model (3/3)
- [x] Scanned-PDF (VLM) path verified: `pxx.pdf` (scanned) → rasterized
      via Poppler → read by Qwen3-VL → classified `geodezja` correctly
- [x] Context-window handling: lowered render DPI + capped extracted text so
      multi-page docs fit an 8192-token local context (configurable in `.env`)
- [x] Full suite green: **15 passed** (`uv run pytest -v`)

## 8. Polish (optional, post-POC)
- [ ] Make categories editable via `.env`
- [ ] Add a `--path` CLI arg to classify an ad-hoc file or folder
- [ ] Optional Tesseract fallback path for text-only LLMs (if ever needed)
- [ ] Add a few simple assertions / a tiny eval over labeled samples
- [ ] README with setup + run instructions (incl. Poppler install, vision model)

## Open questions / notes
- Confirm the exact model identifier to request from LM Studio.
- Pick the concrete category taxonomy (currently a placeholder in config).
- Small local models may struggle with strict structured output — may need a
  retry or a tool-calling-capable model.
- OCR is done by the **vision model** — no Tesseract. The loaded LM Studio model
  must support image input over the OpenAI-compatible API (verify early).
- **Poppler** (system, on PATH) is still needed by `pdf2image` for scanned PDFs.
- Legacy `.doc` is **out of scope** for the first experiments (no clean
  pure-Python reader) — convert to PDF/`.docx` upstream if ever needed.
- **PDF is the priority format** — build and validate the PDF paths first.
- Image/scanned docs rely on the VLM's OCR quality — pick a capable vision model
  (Qwen3-VL / Gemma 3) and watch output reliability on noisy scans.
