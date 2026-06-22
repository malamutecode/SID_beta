# sid_beta — document routing demo

A proof-of-concept that uses a **local LLM** (via LM Studio) to classify
documents, extended with an **interactive demo**: a visual flow-diagram editor,
a departments registry, an employees registry, and a FastAPI backend wrapping
the existing classifier.

- **Classification core** — `src/sid_beta/` (unchanged; see [CLAUDE.md](CLAUDE.md)).
- **Backend** — `backend/app/` (FastAPI, wraps the classifier behind REST).
- **Frontend** — `frontend/` (Vite + React + TypeScript + React Flow).

## Running the demo

### 1. Backend (FastAPI)

```bash
uv sync                                  # install Python deps (incl. FastAPI/uvicorn)
DEMO_ENV=true uv run uvicorn backend.app.main:app --reload --port 8000
```

> On Windows PowerShell: `$env:DEMO_ENV='true'; uv run uvicorn backend.app.main:app --reload --port 8000`
>
> Or set it once: copy `.env.example` → `.env` (in the project root) and put
> `DEMO_ENV=true` there — the backend reads the root `.env` on startup, so you can
> then launch with just `uv run uvicorn backend.app.main:app --reload --port 8000`.
> Env is read once at startup; restart uvicorn after changing it.

Endpoints:

| Method | Path         | Purpose                                                  |
|--------|--------------|----------------------------------------------------------|
| GET    | `/health`    | liveness probe                                           |
| GET    | `/config`    | `{ demo_env, departments }` — surfaces the demo flag     |
| POST   | `/classify`  | one-shot classify text → `{ category, department, confidence, reason }` |
| POST   | `/run-flow`  | **execute a diagram** over a document → full traversal   |
| POST   | `/extract`   | upload a file (PDF/DOCX/image) → extracted plain text    |

These call the existing local-LLM classifier, so **LM Studio must be running**
with a vision model loaded (see [CLAUDE.md](CLAUDE.md)).

In normal (non-demo) mode the Run panel shows a **drag-and-drop file area**:
drop a `.pdf` / `.docx` / image, the backend extracts its text via the existing
`sid_beta.ingest` layer (`/extract`), and that text is then run through the
diagram. Scanned/image-only PDFs (which have no extractable text) aren't
supported by the drop-zone path — use a text PDF or `.docx`.

### The diagram is executable (`/run-flow`)

The flow diagram isn't decorative — it drives the classification. There are two
roles of block:

- **Classifier-type nodes** (Document/Klasyfikator/Warunek zespołu/Warunek osoby)
  carry an `instruction` — the condition, in your own words.
- **Klasa (wyjście)** blocks each declare **one class** (the block's name *is* the
  class). A classifier node classifies into the class blocks it connects to.

Edges are **plain connectors** — they carry no labels/meaning. To define what a
node classifies into, you connect it to one **Klasa** block per class; the chosen
class block then connects onward to the next stage.

The backend walks the graph from the Document node: at each node whose successors
are class blocks, it builds a prompt from that node's instruction + those class
names, classifies, steps onto the chosen class block, then follows it onward —
continuing until a terminal (Pracownik) node. A node with a single plain
connection (and no class blocks) is a pass-through. The response contains every
step's chosen class, confidence and reason, plus the visited node/edge ids so the
UI highlights the path. Class matching is accent/case-insensitive, so a local
model that drops Polish diacritics (e.g. `zespol` vs `zespół`) still routes
correctly. See `backend/app/graph.py`.

> So to change *how* routing works, you edit the **diagram** (node instructions +
> Klasa blocks), not the code. The old `/classify` + the fixed `category →
> department` map in `backend/app/config.py` remain for the simple one-shot path.

### 2. Frontend (Vite + React + TS)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Copy `frontend/.env.example` → `frontend/.env` to override the API URL or the
demo fallback flag. The frontend reads the demo flag from the backend `/config`
endpoint (falling back to `VITE_DEMO_ENV` if the backend is unreachable).

## Demo mode (`DEMO_ENV=true`)

When the backend runs with `DEMO_ENV=true`, the app runs a fixed, predictable
end-to-end scenario:

- **4 fixed sample documents** are preloaded and selectable in the flow editor's
  classify panel (no upload needed).
- **Deterministic final assignment**: each sample document maps to a fixed
  employee via a hardcoded lookup, so the result is always the same. The
  classification step still runs and is shown.
- **A preloaded mock diagram** auto-loads into the React Flow canvas on startup:
  Document → Classify → department branch (*geodezja* / *drogi*) → Team condition
  → Person condition → Employee.

With demo mode **off**, you classify arbitrary pasted text via the live
`/classify` call, build diagrams from scratch, and the registries are editable —
no hardcoded assignment.

## Where the mock & demo data lives

All mock/demo data is isolated so it is easy to find and edit:

| What                              | File                                  |
|-----------------------------------|---------------------------------------|
| Seed departments & employees      | `frontend/src/data/seed.ts`           |
| 4 sample documents                | `frontend/src/data/demo.ts`           |
| Doc → employee assignment map     | `frontend/src/data/demo.ts` (`DOC_TO_EMPLOYEE`) |
| Preloaded mock diagram JSON       | `frontend/src/data/demoFlow.ts`       |
| Category → department routing     | `backend/app/config.py`               |

The registries are backed by in-memory services
(`frontend/src/services/departmentService.ts`,
`employeeService.ts`) with **async** methods, so a real backend/DB can replace
the mock without touching the UI.

## Features

- **Flow editor** (`@xyflow/react`): custom node types (Document, Classifier,
  Department, Team condition, Person condition, Employee); add/connect/rename/
  delete; labelled edges; pan/zoom; JSON export/import. Click a node to edit its
  name and **classification instruction**; the panel shows which classes it
  classifies into (its outgoing edge labels). A **Run** panel executes the
  diagram over a document and highlights the traversed path with each step's
  decision.
- **Departments registry**: list + add/edit/delete with teams.
- **Employees registry**: list + add/edit/delete (department, team, skills,
  active).
- The UI is in **Polish**.
