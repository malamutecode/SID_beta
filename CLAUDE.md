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

On top of the POC there is an **interactive routing demo** (a **FastAPI** backend
that wraps the classifier, plus a **Vite + React + TS** frontend) where the user
builds an **executable flow diagram** that routes a document Document → classify
→ department → team → person → Employee. See **Routing demo** below. The
classifier core in `backend/app/sid_beta/` stays the source of truth — the demo
wraps it, never forks it.

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

## Routing demo (backend + frontend)

A thin layer on top of the classifier. **Two distinct layers, one-way
dependency:** `backend` imports `sid_beta`, never the reverse; the core has no
idea it's served over HTTP.

### Backend (FastAPI, `backend/app/`)

Wraps the classifier behind a small REST API. Run from `backend/` with
`uvicorn app.main:app` (the package is `app`; the core is `app.sid_beta`).

| Method | Path        | Purpose                                                        |
|--------|-------------|----------------------------------------------------------------|
| GET    | `/health`   | liveness probe                                                 |
| GET    | `/config`   | `{ demo_env, departments }` — surfaces the demo flag to the UI |
| POST   | `/classify` | one-shot: text → `{ category, department, confidence, reason }`|
| POST   | `/run-flow` | **execute a diagram** over a document → full traversal         |
| POST   | `/extract`  | upload PDF/DOCX/image → extracted plain text (via `sid_beta.ingest`) |

- `classify_document` calls the unchanged `sid_beta.classifier.classify()`, then
  maps the category → a routing **department** via `CATEGORY_TO_DEPARTMENT` in
  `backend/app/config.py` (the existing taxonomy has no *drogi*, so building-type
  categories route there as a stand-in — edit there, not in the core).
- `/run-flow` (`backend/app/graph.py`) is the graph walker — see below.
- `/extract` writes the upload to a temp file, runs `sid_beta.ingest`, returns
  concatenated text. Scanned/image-only docs (no extractable text) get a clear
  `422`; the drop-zone path needs a text PDF or `.docx`.

### The diagram is executable (output/class-block model)

The flow diagram **drives** the classification — it is not decorative. Two roles
of node:

- **Classifier-type nodes** (`document`, `classifier`, `teamCondition`,
  `personCondition`) carry an `instruction` (the condition, in the user's words).
- **`class` (output) blocks** each declare **one class** — the block's *label is
  the class name*.

A classifier node classifies into the **`class` blocks it connects to**; the
chosen class block then flows onward to the next stage. **Edges are plain
connectors — they carry no labels/meaning.** The backend walks from the start
(Document) node: at each node whose successors are class blocks it builds a
prompt from that node's instruction + those class names, classifies, steps onto
the chosen class block, follows it onward, and continues until a terminal node
(`employee`). A node with a single plain connection (no class blocks) is a
pass-through. The response returns every step's chosen class/confidence/reason
plus the visited node/edge ids so the UI can highlight the path.

So to change routing behaviour you edit the **diagram** (node instructions +
class blocks), not the code. The classifier primitive for this is
`classify_into(payloads, classes, instruction)` in `classifier.py` (additive;
`classify()` is untouched), returning a `DynamicClassification` whose class is
matched **accent/case-insensitively** (`models._fold`) so a local model dropping
Polish diacritics — e.g. `zespol` vs `zespół`, including the stroked `ł` — still
routes.

### Frontend (Vite + React + TS, `frontend/`)

- **Flow editor** (`@xyflow/react`): custom node types, add/connect/rename/delete,
  pan/zoom, JSON export/import. Click a node to edit its name + instruction; a Run
  panel executes the diagram and highlights the traversed path. Non-demo input is
  a **drag-and-drop file area** (→ `/extract` → `/run-flow`).
- **Departments** and **Employees** registries: list + CRUD, behind an **async
  in-memory service layer** (`src/services/`) so a real backend/DB can replace the
  mock without touching the UI.
- **UI strings are in Polish**; code identifiers/types stay English.

### Demo mode (`DEMO_ENV`)

When `DEMO_ENV=true`, the app runs a fixed, predictable scenario: 4 preloaded
sample documents (selectable), a **deterministic** doc→employee map (final
assignment is fixed, not from live output), and an auto-loaded mock diagram. All
demo data is isolated in `frontend/src/data/` (`demo.ts`, `demoFlow.ts`,
`seed.ts`). With it off: live `/run-flow`, user-built diagrams, editable
registries, file upload.

## Layout

The repo is split into a **self-contained backend** and a **frontend**, each
independently dockerized. The classifier core lives *inside* the backend as the
`app.sid_beta` subpackage (so the backend image is self-contained); the import
boundary is still one-way (`app` → `app.sid_beta`).

```
sid_beta/
├── CLAUDE.md             # this file
├── TASKS.md              # task checklist (Part 1 POC + Part 2 demo)
├── README.md             # how to run (local + Docker) + where mock data lives
├── docker-compose.yml    # orchestrates backend + frontend
├── docs/                 # technical memo + client hardware options
├── backend/              # SELF-CONTAINED BACKEND (Python)
│   ├── pyproject.toml    # uv project; package = `app`; pytest config
│   ├── uv.lock
│   ├── .python-version   # pins 3.13
│   ├── .env / .env.example  # SID_* + DEMO_ENV + CORS (read by both settings classes)
│   ├── Dockerfile        # python:3.13-slim + uv + Poppler; runs uvicorn app.main:app
│   ├── .dockerignore
│   ├── samples/          # example input files (+ samples_description.md labels)
│   ├── tests/            # test_basics (LLM-free), test_e2e / test_perf_e2e (live)
│   └── app/              # importable package `app`
│       ├── main.py       # FastAPI app + routes (/health /config /classify /run-flow /extract)
│       ├── config.py     # BackendSettings (DEMO_ENV, CORS) + category→department map
│       ├── schemas.py    # request/response + flow models
│       ├── graph.py      # executable-diagram walker (/run-flow)
│       └── sid_beta/     # CLASSIFIER CORE (no web deps; subpackage of app)
│           ├── config.py     # Settings (SID_* env) + CATEGORIES taxonomy
│           ├── models.py     # Classification + DynamicClassification (+ _fold)
│           ├── ingest.py     # file → text extraction + image (VLM) dispatch
│           ├── classifier.py # Agent, classify(), classify_into(), text cap
│           ├── samples.py    # inline document text samples
│           └── main.py       # CLI entrypoint: ingest samples/, classify, print
└── frontend/             # VITE + REACT + TS app (Polish UI)
    ├── Dockerfile        # multi-stage: npm build → nginx serves dist/ + proxies /api
    ├── nginx.conf        # SPA + /api → backend:8000
    └── src/
        ├── flow/         # React Flow editor, node types, run/node panels, dropzone
        ├── registries/   # Departments + Employees pages
        ├── services/     # async data layer + backend client
        └── data/         # seed + isolated demo data (demo.ts, demoFlow.ts, seed.ts)
```

## Commands

```bash
# Backend (run from backend/)
cd backend
uv sync                              # create venv + install deps
uv run uvicorn app.main:app --reload --port 8000   # API on http://localhost:8000
uv run sid-beta                      # classifier CLI: ingest samples/, classify, print
uv run pytest                        # all tests (e2e auto-skip if LM Studio down)
uv run pytest -m e2e -v              # live correctness tests (needs LM Studio)
uv run pytest tests/test_perf_e2e.py -s   # regenerate perf_report.txt
uv add <pkg>                         # add a dependency

# Frontend (run from frontend/)
cd frontend && npm install && npm run dev   # http://localhost:5173

# Everything in Docker (from the repo root)
docker compose up --build            # frontend http://localhost:8080, API under /api
```

> `DEMO_ENV` and CORS origins are read **once at backend startup** (from
> `backend/.env` or real env vars; env wins). `--reload` re-runs code on file
> changes but does **not** re-read env vars — restart uvicorn after changing
> `DEMO_ENV`. The frontend reads the demo flag from `/config` on page load, so
> refresh the tab too.

## Configuration

Core settings live in `app/sid_beta/config.py` (`Settings`, env prefix `SID_`,
also read from `backend/.env`). See `backend/.env.example`. Key values:

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

### Demo / backend settings

Both settings classes (`Settings` for `SID_*` and `BackendSettings` for the demo)
read **`backend/.env`** — resolved by an absolute path from `__file__`, so it
loads regardless of CWD (`uv run` from anywhere, Docker `WORKDIR /app`). Env vars
take precedence. See `backend/.env.example`.

| Key | Default | Purpose |
|-----|---------|---------|
| `DEMO_ENV` | `false` | turn the fixed demo scenario on/off (bare name, no `SID_` prefix) |
| `SID_ALLOWED_ORIGINS` | localhost/127.0.0.1 :5173–:5175 | CORS origins for the Vite dev server |

Under Docker, CORS is a non-issue: nginx serves the frontend and proxies `/api`
to the backend, so the browser sees one origin (no preflight). Pass `DEMO_ENV`
and `SID_BASE_URL=http://host.docker.internal:1234/v1` (LM Studio on the host)
via compose — see `docker-compose.yml`.

The frontend reads `VITE_API_BASE_URL` (local dev: `http://localhost:8000`;
Docker: `/api`, set by its Dockerfile) and `VITE_DEMO_ENV` (a fallback only if
`/config` is unreachable) — see `frontend/.env.example`.

## Conventions

- Configuration (base URL, model name, category list) lives in `config.py` /
  `.env` — never hardcode it across modules.
- Categories are a single list the prompt is built from; changing the taxonomy
  should mean editing one place.
- Keep the LLM-facing prompt explicit about the allowed categories and the
  required output shape.
- Prefer `agent.run_sync` for the POC; async is out of scope unless needed.

### Demo layer

- **Don't modify the classifier core for the demo.** Wrap it. `classify_into()`
  was added additively; `classify()` and the existing prompt are untouched.
- The dependency is one-way: `backend` → `sid_beta`. Keep `sid_beta` free of
  FastAPI/web concerns.
- Keep all demo data (4 sample docs, doc→employee map, mock diagram) isolated in
  `frontend/src/data/` so it's trivial to find and edit.
- Registries go through the async service layer (`frontend/src/services/`), never
  touching mock arrays directly — that's the seam for a future real backend.
- UI text is Polish; keep code identifiers, types, and node-type keys English.
