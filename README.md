# sid_beta — document routing demo

A proof-of-concept that uses a **local LLM** (via LM Studio) to classify
documents, extended with an **interactive demo**: a visual flow-diagram editor,
a departments registry, an employees registry, and a FastAPI backend wrapping
the classifier.

- **Backend** — `backend/` (FastAPI; package `app`, classifier core at
  `app/sid_beta/`). Self-contained and dockerized.
- **Frontend** — `frontend/` (Vite + React + TypeScript + React Flow). Polish UI.

## Prerequisite: LM Studio (both run modes)

Classification runs on a **local vision-language model** served by
[LM Studio](https://lmstudio.ai/), on the **host machine** in both modes:

1. Load a vision model (the demo defaults to `qwen/qwen3-vl-8b`).
2. Start LM Studio's local server (Developer / Local Server tab) — default
   `http://localhost:1234/v1`.

The app still launches without it, but `/classify` and `/run-flow` will error
until the server is up.

---

## Run with Docker (recommended)

From the repo root:

```bash
docker compose up --build
```

- **Frontend:** <http://localhost:8080> — nginx serves the build and proxies
  `/api` to the backend (so the browser sees one origin; no CORS setup needed).
- **Backend API** also exposed directly on <http://localhost:8000>.

`docker-compose.yml` sets `DEMO_ENV=true` and points the backend at LM Studio on
the host via `http://host.docker.internal:1234/v1`. Edit those env values there.
Stop with `Ctrl+C`, or `docker compose down`.

---

## Run locally (without Docker)

Needs **uv** (Python 3.13) and **Node** (with npm). Use two terminals.

### 1. Backend — from `backend/`

```bash
cd backend
uv sync                                              # create venv + install deps
DEMO_ENV=true uv run uvicorn app.main:app --reload --port 8000
```

> Windows PowerShell: `$env:DEMO_ENV='true'; uv run uvicorn app.main:app --reload --port 8000`
>
> Or set it once: copy `backend/.env.example` → `backend/.env`, put
> `DEMO_ENV=true` there, then just `uv run uvicorn app.main:app --reload --port 8000`.
> Env is read once at startup — restart uvicorn after changing it.

The backend serves on <http://localhost:8000>.

### 2. Frontend — from `frontend/`

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

It calls the backend at `http://localhost:8000` by default. Copy
`frontend/.env.example` → `frontend/.env` to override `VITE_API_BASE_URL` or the
`VITE_DEMO_ENV` fallback. The demo flag actually comes from the backend `/config`
endpoint; `VITE_DEMO_ENV` is only used if the backend is unreachable.

> Vite uses port 5174/5175 if 5173 is taken; the backend's CORS allows
> 5173–5175. For other ports, set `SID_ALLOWED_ORIGINS` in `backend/.env`.

### Classifier CLI (no web, optional)

```bash
cd backend
uv run sid-beta      # ingest backend/samples + inline samples, classify, print
uv run pytest        # tests (live e2e auto-skip if LM Studio is down)
```

---

## Backend API

| Method | Path         | Purpose                                                  |
|--------|--------------|----------------------------------------------------------|
| GET    | `/health`    | liveness probe                                           |
| GET    | `/config`    | `{ demo_env, departments }` — surfaces the demo flag     |
| POST   | `/classify`  | one-shot classify text → `{ category, department, confidence, reason }` |
| POST   | `/run-flow`  | **execute a diagram** over a document → full traversal   |
| POST   | `/extract`   | upload a file (PDF/DOCX/image) → extracted plain text    |

In normal (non-demo) mode the Run panel shows a **drag-and-drop file area**: drop
a `.pdf` / `.docx` / image → the backend extracts text via `app/sid_beta/ingest`
(`/extract`) → the text is run through the diagram (`/run-flow`). Scanned /
image-only PDFs (no extractable text) aren't supported by the drop-zone path —
use a text PDF or `.docx`.

### The diagram is executable (`/run-flow`)

The flow diagram isn't decorative — it drives the classification. Two roles of
block:

- **Classifier-type nodes** (Document / Klasyfikator / Warunek zespołu / Warunek
  osoby) carry an `instruction` — the condition, in your own words.
- **Klasa (wyjście)** blocks each declare **one class** (the block's name *is* the
  class). A classifier node classifies into the Klasa blocks it connects to.

Edges are **plain connectors** — they carry no meaning. To define what a node
classifies into, connect it to one **Klasa** block per class; the chosen class
block then connects onward to the next stage.

The backend walks the graph from the Document node: at each node whose successors
are class blocks it builds a prompt from that node's instruction + those class
names, classifies, steps onto the chosen class block, follows it onward — until a
terminal (Pracownik) node. A node with a single plain connection (no class
blocks) is a pass-through. The response returns every step's chosen class,
confidence and reason, plus the visited node/edge ids so the UI highlights the
path. Class matching is accent/case-insensitive, so a local model that drops
Polish diacritics (e.g. `zespol` vs `zespół`) still routes. See
`backend/app/graph.py`.

> To change *how* routing works, edit the **diagram** (node instructions + Klasa
> blocks), not the code. The simpler `/classify` + the fixed `category →
> department` map in `backend/app/config.py` remain for the one-shot path.

## Demo mode (`DEMO_ENV=true`)

When the backend runs with `DEMO_ENV=true` the app runs a fixed, predictable
end-to-end scenario:

- **4 fixed sample documents** are preloaded and selectable in the Run panel (no
  upload needed).
- **Deterministic final assignment**: each sample document maps to a fixed
  employee via a hardcoded lookup, so the result is always the same. The
  classification steps still run and are shown.
- **A preloaded mock diagram** auto-loads into the canvas on startup: Document →
  Klasyfikuj → department (*geodezja* / *drogi*) → Warunek zespołu → Warunek osoby
  → Pracownik.

With demo mode **off**: you drop your own document, build diagrams from scratch,
and the registries are editable — no hardcoded assignment.

## Where the mock & demo data lives

All mock/demo data is isolated so it's easy to find and edit:

| What                              | File                                  |
|-----------------------------------|---------------------------------------|
| Seed departments & employees      | `frontend/src/data/seed.ts`           |
| 4 sample documents                | `frontend/src/data/demo.ts`           |
| Doc → employee assignment map     | `frontend/src/data/demo.ts` (`DOC_TO_EMPLOYEE`) |
| Preloaded mock diagram            | `frontend/src/data/demoFlow.ts`       |
| Category → department routing     | `backend/app/config.py`               |

The registries are backed by async in-memory services
(`frontend/src/services/`), so a real backend/DB can replace the mock without
touching the UI.

## Features

- **Flow editor** (`@xyflow/react`): node types Document, Classifier, Klasa
  (output), Team condition, Person condition, Employee; add/connect/rename/delete;
  pan/zoom; JSON export/import. Click a node to edit its name and **classification
  instruction**; the panel shows which Klasa blocks it classifies into. A **Run**
  panel executes the diagram over a document and highlights the traversed path
  with each step's decision.
- **Departments registry**: list + add/edit/delete with teams.
- **Employees registry**: list + add/edit/delete (department, team, skills,
  active).
- The UI is in **Polish**.

See [CLAUDE.md](CLAUDE.md) for architecture, configuration, and conventions.
