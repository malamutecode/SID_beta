# TASKS — Document Classification POC

Goal: a minimal Pydantic AI app that classifies **document files** — `.pdf`
(text and scanned/image-only, the **primary** format), `.docx`, images (`.png`,
`.jpg`/`.jpeg`), plus inline text — into configurable categories using LM
Studio, returning structured output (category + confidence + reason). Native
text (`.docx`, text PDFs, inline) is extracted to text; images and scanned PDF
pages are sent **directly to a vision model** (VLM does the OCR — no Tesseract).

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

## Done — POC built & validated

- [x] **Scaffold:** uv project, Python 3.13, `src/sid_beta/` package, deps
      (`pydantic-ai-slim[openai]`, `pydantic-settings`, `pypdf`, `python-docx`,
      `pdf2image`, `pillow`).
- [x] **Config:** `config.py` `Settings` (`SID_*` env) + `CATEGORIES` taxonomy;
      `.env.example`. (See CLAUDE.md → Configuration.)
- [x] **Schema:** `models.py` `Classification` (category/confidence/reason),
      `category` validated against `CATEGORIES`.
- [x] **Ingestion:** `ingest.py` dispatches by extension — `.pdf` text via
      `pypdf`; scanned pages + images → `BinaryContent` for the VLM; `.docx` via
      `python-docx`; `.doc` rejected with a clear message.
- [x] **Classifier:** `classifier.py` — Agent (`OpenAIChatModel` +
      `OpenAIProvider`) against LM Studio, `classify()`, text cap.
- [x] **Entrypoint:** `main.py` ingests `samples/` + inline samples, classifies,
      pretty-prints; resilient to ingest/connection errors.
- [x] **Tests:** `test_basics.py` (LLM-free) + `test_e2e.py` / `test_perf_e2e.py`
      (live, auto-skip if server down / Poppler missing). Full suite green.
- [x] **Validated end-to-end** against `qwen/qwen3-vl-8b`: text PDFs and a
      scanned PDF (Poppler → VLM) all classified correctly. Context-window caps
      (DPI + text) added so multi-page/scanned docs fit an 8192-token context.

## Operational prerequisites (per machine)

- [ ] LM Studio running with a **vision model** loaded and the local server on.
- [ ] **Poppler** available (on PATH or via `SID_POPPLER_PATH`) — needed only
      for scanned PDFs.

## Backlog (optional, post-POC)

- [ ] Make categories editable via `.env` (currently in `config.py`).
- [ ] Add a `--path` CLI arg to classify an ad-hoc file or folder.
- [ ] Optional Tesseract fallback path for text-only LLMs (if ever needed).
- [ ] A small labeled eval (accuracy/confusion over more documents).
- [ ] README with setup + run instructions (Poppler install, vision model).

## Notes

- OCR is done by the **vision model** — no Tesseract. The loaded LM Studio model
  must support image input over the OpenAI-compatible API (verify early).
- Legacy `.doc` is out of scope (no clean pure-Python reader) — convert upstream.
- Image/scanned docs depend on the VLM's OCR quality; the scanned path is also
  the slower, per-page-costly path (see `docs/TECHNICAL_MEMO.md`).
