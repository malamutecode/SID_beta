# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## Project

**sid_beta** — a proof-of-concept that uses [Pydantic AI](https://ai.pydantic.dev/)
to drive a **local LLM** (served by **LM Studio**) for **document classification**.

The POC accepts **real document files** — `.pdf` (both text PDFs and
**scanned/image-only PDFs**), `.docx`, and **images** (`.png`, `.jpg`/`.jpeg`) —
plus inline text samples. PDF is the primary format; legacy `.doc` is out of
scope. It relies on a **local vision-language model** (VLM, e.g. Qwen3-VL or
Gemma 3) for OCR: images and scanned pages are sent **directly to the model** as
image content, so there is **no separate OCR engine** (no Tesseract).
Native-text inputs (`.docx`, text PDFs, inline text) are extracted to plain text
first; image-bearing inputs are passed as image bytes. The model returns a
**structured** result: predicted category, confidence, and a short rationale.
Categories are configurable in one place so the classifier can be re-pointed at
any document taxonomy.

This is a learning/evaluation POC — keep it small, readable, and dependency-light.

## Stack

| Concern          | Choice                                            |
|------------------|---------------------------------------------------|
| Language         | Python **3.13** (pinned via `uv`)                 |
| Package manager  | **uv** (`pyproject.toml` + `uv.lock`)             |
| LLM framework    | **pydantic-ai** (`pydantic-ai-slim[openai]`)      |
| Local LLM server | **LM Studio** (OpenAI-compatible API)             |
| Validation       | **pydantic** v2 (structured output models)        |
| Doc extraction   | `python-docx`, `pypdf`                             |
| OCR              | **VLM-native** (vision model reads images directly — no Tesseract) |
| PDF rasterizing  | `pdf2image` + **Poppler** (system) — scanned PDFs only |

## LM Studio

LM Studio exposes an **OpenAI-compatible** REST API. Connect Pydantic AI to it
via `OpenAIProvider(base_url=...)` — no real API key is required (use any
placeholder string).

- Default base URL: `http://localhost:1234/v1`
- Start the server from LM Studio's **Developer / Local Server** tab, load a
  **vision** model, then click **Start Server**.
- The `model` name passed to `OpenAIChatModel(...)` should match the model
  identifier shown by LM Studio. Many local models also work with any string,
  but matching it avoids surprises.
- The POC defaults to `qwen/qwen3-vl-8b` (set in `config.py`, overridable via
  `SID_MODEL_NAME`). This is the model the test suite is validated against.

> Note: smaller local models can be unreliable at strict structured output.
> If JSON/tool-call parsing fails, lower the temperature and/or pick a model
> known to support tool/function calling.

> **Vision required.** Because OCR is done by the model, the loaded model must be
> a **vision-language model** (e.g. Qwen3-VL, Gemma 3) and LM Studio must serve
> image input over its OpenAI-compatible API. Smoke-test image input early — not
> every local runtime exposes multimodal input over the API. A text-only model
> will only work for the native-text paths (`.docx`, text PDFs, inline text).

## Wiring (reference)

```python
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

class Classification(BaseModel):
    category: str
    confidence: float
    reason: str

model = OpenAIChatModel(
    "qwen/qwen3-vl-8b",  # name as shown in LM Studio
    provider=OpenAIProvider(base_url="http://localhost:1234/v1", api_key="lm-studio"),
)

agent = Agent(model, output_type=Classification)  # note: output_type, not result_type
result = agent.run_sync("...document text...")
print(result.output)
```

## Document ingestion

Inputs are files of mixed formats. The ingestion layer dispatches on file type
and produces **one of two payload kinds** for the classifier:

- **text** — extracted plain text, sent as a normal prompt.
- **image** — raw image bytes, sent to the VLM as `BinaryContent` (the model
  does the OCR). A document may yield several image payloads (one per page).

| Format                     | Ingestion approach                                       |
|----------------------------|----------------------------------------------------------|
| `.pdf` (text)              | **text** — `pypdf` extraction                            |
| `.pdf` (scanned / image)   | **image** — rasterize pages (`pdf2image`/Poppler) → VLM  |
| `.png` `.jpg` `.jpeg`      | **image** — bytes sent straight to the VLM               |
| `.docx`                    | **text** — `python-docx` (paragraphs + tables)           |
| inline text                | **text** — used as-is                                    |
| `.doc` (legacy)            | **out of scope** for now — convert to PDF/`.docx`        |

OCR is performed by the **vision model**, not a local engine — there is **no
Tesseract**. Image and scanned-page bytes are passed to the agent as
`BinaryContent(data=..., media_type='image/png' | 'image/jpeg')`.

**Poppler** (system dependency, on PATH) is still required for `pdf2image` to
rasterize **scanned** PDFs into page images. Text PDFs, `.docx`, and inline text
need no system dependencies.

PDF strategy (primary path): try `pypdf` text extraction first; if a page yields
little/no text, treat it as scanned — rasterize it and send the page image to
the VLM. Legacy `.doc` is **not handled** — convert to PDF or `.docx` upstream.

### Passing images to the agent (reference)

```python
from pathlib import Path
from pydantic_ai import BinaryContent

result = agent.run_sync([
    "Classify this document.",
    BinaryContent(data=Path("scan.png").read_bytes(), media_type="image/png"),
])
```

## Layout

```
sid_beta/
├── CLAUDE.md            # this file
├── TASKS.md             # POC task checklist
├── pyproject.toml       # uv-managed project + deps; pytest config
├── .python-version      # pins 3.13
├── .env.example         # documents the SID_* settings
├── docs/                # technical memo + client hardware options
├── samples/             # example input files (+ samples_description.md labels)
├── tests/
│   ├── test_basics.py   # LLM-free: schema + ingestion dispatch
│   ├── test_e2e.py      # live: classify samples, assert expected labels
│   └── test_perf_e2e.py # live: time classification, write perf_report.txt
└── src/sid_beta/
    ├── __init__.py
    ├── config.py        # Settings (SID_* env) + CATEGORIES taxonomy
    ├── models.py        # pydantic output schema (Classification)
    ├── ingest.py        # file → text extraction + image (VLM) dispatch
    ├── classifier.py    # builds the Agent, classify(), text cap
    ├── samples.py       # inline document text samples
    └── main.py          # entrypoint: ingest files, classify, print results
```

## Commands

```bash
uv sync                              # create venv + install deps
uv run python -m sid_beta.main       # ingest samples/ + inline, classify, print
uv run pytest                        # all tests (e2e auto-skip if server down)
uv run pytest -m e2e -v              # live correctness tests (needs LM Studio)
uv run pytest tests/test_perf_e2e.py -s   # regenerate docs/perf_report.txt
uv add <pkg>                         # add a dependency
```

## Configuration

Settings live in `config.py` (`Settings`, env prefix `SID_`, also read from
`.env`). See `.env.example`. Key values:

| Key | Default | Purpose |
|-----|---------|---------|
| `SID_BASE_URL` | `http://localhost:1234/v1` | LM Studio endpoint |
| `SID_MODEL_NAME` | `qwen/qwen3-vl-8b` | model id as shown in LM Studio |
| `SID_API_KEY` | `lm-studio` | placeholder; LM Studio needs no real key |
| `SID_PDF_TEXT_MIN_CHARS` | `20` | below this, a PDF page is treated as scanned |
| `SID_POPPLER_PATH` | _(empty)_ | Poppler `bin` dir if not on PATH (scanned PDFs) |
| `SID_PDF_RENDER_DPI` | `120` | rasterization DPI; lower ⇒ fewer vision tokens |
| `SID_MAX_TEXT_CHARS` | `6000` | cap on extracted text per doc (fits small context) |

The category taxonomy is the `CATEGORIES` list in `config.py` (currently:
`zgloszenia budowlane`, `podatki`, `umowa B2B`, `geodezja`). `models.py`
validates the predicted `category` against it. Expected sample labels live in
`samples/samples_description.md` and the e2e test's `EXPECTED` map.

> Local models have small context windows (the test model: 8192 tokens). The
> `SID_PDF_RENDER_DPI` and `SID_MAX_TEXT_CHARS` caps keep multi-page / scanned
> requests within budget; raise them if you load a larger-context model.

## Conventions

- Configuration (base URL, model name, category list) lives in `config.py` /
  `.env` — never hardcode it across modules.
- Categories are a single list the prompt is built from; changing the taxonomy
  should mean editing one place.
- Keep the LLM-facing prompt explicit about the allowed categories and the
  required output shape.
- Prefer `agent.run_sync` for the POC; async is out of scope unless needed.
