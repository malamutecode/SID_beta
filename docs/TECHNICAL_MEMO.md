# Technical Memorandum — Local Document Classification POC (`sid_beta`)

| | |
|---|---|
| **Subject** | Local LLM document classification proof-of-concept |
| **Status** | POC — validated end-to-end |
| **Date** | 2026-06-21 |
| **Author** | pawe213 |

---

## 1. Purpose & summary

`sid_beta` is a proof-of-concept that classifies documents into a configurable
taxonomy using a **local** large language model — no cloud API, no data leaving
the machine. It is built on **Pydantic AI** and talks to a model served locally
by **LM Studio** over an OpenAI-compatible API.

The POC ingests real document files (`.pdf`, `.docx`, images), extracts their
content, and asks the model to return a **structured** result — category,
confidence, and a short rationale — validated against a fixed list of allowed
categories. Both digital-text and **scanned/image-only** documents are
supported: scanned content is read directly by a **vision-language model (VLM)**,
so no separate OCR engine (e.g. Tesseract) is required.

The POC has been validated against four real sample documents (Polish
administrative forms and a scanned document) and classifies all of them
correctly, with per-document latency measured (Section 6).

---

## 2. Scope

**In scope**

- Configurable category taxonomy (currently: `zgloszenia budowlane`, `podatki`,
  `umowa B2B`, `geodezja`).
- File ingestion: text PDFs, scanned/image PDFs, images (PNG/JPEG), `.docx`,
  and inline text.
- Structured classification output with validation.
- A correctness test suite and a performance-measurement test.

**Out of scope (POC stage)**

- Legacy `.doc` (binary Word) — not supported; convert to PDF/`.docx` upstream.
- Batch/large-scale throughput, queuing, parallelism, or a service/API layer.
- Fine-tuning or prompt-tuning of the model.
- Production concerns: auth, persistence, observability, retries/backoff.

---

## 3. Architecture

```
file (pdf / docx / image)            inline text
        │                                  │
        ▼                                  │
┌───────────────────┐                      │
│  ingest.py        │  dispatch on type    │
│  ──────────────   │                      │
│  text  → str      │                      │
│  scan  → image    │◄──── Poppler (pdf2image) for scanned PDFs
└───────┬───────────┘                      │
        │ payloads: list[str | BinaryContent]
        ▼                                  ▼
┌─────────────────────────────────────────────┐
│  classifier.py — Pydantic AI Agent           │
│  • OpenAIChatModel + OpenAIProvider           │
│  • output_type = Classification (validated)   │
│  • caps extracted text to fit context window  │
└───────────────────┬──────────────────────────┘
                    │ OpenAI-compatible HTTP
                    ▼
        ┌───────────────────────────┐
        │  LM Studio (localhost)     │
        │  vision-language model     │
        └───────────────────────────┘
                    │
                    ▼
        Classification(category, confidence, reason)
```

### Modules

| Module | Responsibility |
|---|---|
| `config.py` | Settings (endpoint, model, DPI, caps) + the `CATEGORIES` taxonomy. Env-overridable via `SID_*` / `.env`. |
| `models.py` | `Classification` Pydantic schema; validator constrains `category` to `CATEGORIES`. |
| `ingest.py` | File → payloads. Text via `pypdf`/`python-docx`; scanned pages/images → `BinaryContent` for the VLM. |
| `classifier.py` | Builds the Pydantic AI `Agent` against LM Studio; `classify()` runs it and returns structured output. |
| `samples.py` / `main.py` | Inline samples and the CLI entrypoint. |
| `tests/` | LLM-free unit tests + live e2e correctness and performance tests. |

### Ingestion strategy

- **Text PDF** → `pypdf` text extraction (cheap, fast).
- **Scanned PDF** → if a page yields < `pdf_text_min_chars` characters, it is
  treated as scanned: rasterized via `pdf2image`/Poppler at a configurable DPI
  and sent to the VLM as an image. **OCR is performed by the model.**
- **Images** → sent directly as image bytes.
- **`.docx`** → text via `python-docx`.

### Context-window handling

Local models have small context windows (the test model: **8192 tokens**). Two
configurable guards keep requests within budget:

- `SID_PDF_RENDER_DPI` (default **120**) — lower DPI ⇒ fewer image tokens.
- `SID_MAX_TEXT_CHARS` (default **6000**) — caps extracted text per document.

---

## 4. Technology stack

| Component | Choice / version |
|---|---|
| Language | Python 3.13 |
| Package manager | uv |
| LLM framework | `pydantic-ai-slim[openai]` ≥ 1.107 |
| Validation | Pydantic v2 (`pydantic-settings`) |
| PDF text | `pypdf` |
| PDF rasterization | `pdf2image` + **Poppler** (system dependency) |
| DOCX | `python-docx` |
| Images | Pillow |
| Local LLM server | LM Studio (OpenAI-compatible API) |
| Test model | `qwen/qwen3-vl-8b` (vision-language) |

**System dependency:** Poppler (the `pdftoppm` binary) is required only for
scanned PDFs. It is not pip-installable; the path can be set via
`SID_POPPLER_PATH` when not on `PATH`.

---

## 5. Hardware requirements

Local LLM inference is **GPU-VRAM-bound**. Requirements are driven almost
entirely by the model: an 8B vision-language model in a quantized form needs
roughly 6–8 GB of VRAM to run on-GPU. The application code itself (ingestion,
Pydantic AI) is lightweight.

### Reference (validation) machine

The performance figures in Section 6 were measured on:

| Resource | Spec |
|---|---|
| CPU | Intel Core i7-11370H (4C / 8T, 3.3 GHz) |
| RAM | 16 GB |
| GPU | NVIDIA GeForce RTX 3070 (Ampere), **8 GB VRAM** (driver 572.61) |
| OS | Windows 11 Pro |
| Model | `qwen/qwen3-vl-8b`, served by LM Studio |

### Recommended minimums

| Tier | GPU / VRAM | Notes |
|---|---|---|
| **Minimum (GPU)** | NVIDIA GPU, **≥ 8 GB VRAM** | Runs an ~8B VLM (quantized) with an 8K context, as validated. |
| **Comfortable** | **12–16 GB VRAM** | Larger context windows, higher render DPI, headroom for bigger models. |
| **CPU-only** | — | Technically possible but **much** slower; not recommended for the vision/OCR path. |
| RAM | ≥ 16 GB | For the OS, LM Studio, and document handling. |
| Disk | A few GB | Model weights dominate (multi-GB per model). |

> The 8 GB VRAM figure is a practical floor for the validated 8B vision model.
> Smaller models (e.g. a 4B VLM, also available locally) reduce the requirement
> further at some accuracy cost; larger/long-context models raise it.

---

## 6. Performance

Measured by the performance test (`tests/test_perf_e2e.py`), which times the
full `classify()` call per document. Report: `perf_report.txt`.

**Configuration:** model `qwen/qwen3-vl-8b`, render DPI 120, max text 6000 chars,
on the reference machine above.

| File | Pages | Data type | Time (s) | s/page | Category |
|---|---:|---|---:|---:|---|
| PB-2.pdf | 2 | text | ~6.0 | ~3.0 | zgloszenia budowlane |
| pcc-3-06-08.pdf | 3 | text | ~6.3 | ~2.1 | podatki |
| sd-3-06-015.pdf | 4 | text | ~5.5 | ~1.4 | podatki |
| pxx.pdf | 1 | image (scanned/VLM) | ~5.1 | ~5.1 | geodezja |

**Aggregate (representative run):** 4 documents, total ≈ 23 s, average ≈ 5.7 s
per document (min ≈ 5.1 s, max ≈ 6.3 s).

### Observations

- **Per-document latency is a few seconds** on the reference hardware — adequate
  for interactive / low-volume use.
- **Data type matters more than page count.** Text PDFs are cheap regardless of
  length because only extracted text is sent. Image (scanned) pages are the
  expensive path — each rasterized page is processed by the vision model.
- **Per-page cost of the image path is the headline scaling risk.** A
  multi-page scanned document was previously observed at ~18 s/page (and ~54 s
  for a 3-page scan); reducing render DPI brought this down substantially. The
  current single-page scan classifies in ~5 s.
- **Timings vary run-to-run** (±~1 s) due to model/server scheduling; treat the
  figures as representative, not exact.
- **Earlier context-overflow failures** (an 8K window exceeded by image-heavy or
  multi-page requests) were resolved by the DPI and text-cap guards (Section 3).

### Accuracy

On the four-document sample set, classification is **4/4 correct** against the
labels in `samples/samples_description.md`, covering both the text and the
scanned/vision paths.

---

## 7. Limitations & risks

- **Small sample set.** Accuracy is validated on four documents; this is a
  functional proof, not a statistical accuracy claim.
- **Context window.** The 8K-token model bounds document size; very long or
  high-page-count scans require lower DPI/text caps or a larger-context model.
- **Image-path throughput.** Scanned/multi-page documents are several times
  slower than text documents and scale per page.
- **Model dependency.** Results depend on the loaded VLM; smaller models trade
  accuracy for speed/VRAM, and structured-output reliability varies by model.
- **System dependency.** The scanned-PDF path requires Poppler installed.
- **Legacy `.doc`** is unsupported.

---

## 8. Recommendations / next steps

- **Broaden evaluation:** assemble a larger labeled set per category and report
  accuracy/confusion, not just pass/fail.
- **Larger context model** if multi-page scans are common, to avoid aggressive
  text/DPI capping.
- **Throughput:** if volume grows, consider batching, async requests, or routing
  text vs. image documents differently (text is cheap; reserve the VLM for scans).
- **Robustness:** add retry/backoff and clearer failure reporting for production.
- **Confidence calibration:** decide how to act on low-confidence predictions
  (e.g. human review queue).

---

## 9. How to run

```bash
uv sync                                   # install dependencies
# Start LM Studio, load a vision model (e.g. qwen/qwen3-vl-8b), start the server.
uv run python -m sid_beta.main            # classify sample documents

uv run pytest                             # all tests (e2e skip if server down)
uv run pytest -m e2e -v                   # live correctness tests
uv run pytest tests/test_perf_e2e.py -s   # regenerate perf_report.txt
```

Configuration is via environment variables (`SID_*`) or a `.env` file; see
`.env.example`.
