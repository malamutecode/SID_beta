# TASKS — Document Classification POC + Routing Demo

This file tracks two phases of work:

- **Part 1 — Classification POC:** a minimal Pydantic AI app that classifies
  **document files** — `.pdf` (text and scanned/image-only, the **primary**
  format), `.docx`, images (`.png`, `.jpg`/`.jpeg`), plus inline text — into
  configurable categories using LM Studio, returning structured output
  (category + confidence + reason). Native text is extracted; images and scanned
  PDF pages go **directly to a vision model** (VLM does the OCR — no Tesseract).
- **Part 2 — Routing demo:** an interactive demo on top of the POC — a FastAPI
  backend wrapping the classifier and a Vite + React + TS frontend (executable
  flow-diagram editor, departments/employees registries, demo mode).

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

# Part 1 — Classification POC

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
- [x] README with setup + run instructions (Poppler install, vision model).

## Notes

- OCR is done by the **vision model** — no Tesseract. The loaded LM Studio model
  must support image input over the OpenAI-compatible API (verify early).
- Legacy `.doc` is out of scope (no clean pure-Python reader) — convert upstream.
- Image/scanned docs depend on the VLM's OCR quality; the scanned path is also
  the slower, per-page-costly path (see `docs/TECHNICAL_MEMO.md`).

---

# Part 2 — Routing demo

Interactive demo on top of the existing local-LLM document classifier.
Frontend: Vite + React + TS. Backend: FastAPI wrapping the existing classifier.

## 0. Inspection
- [x] Read existing classifier / config / ingest / models
- [x] Inspect samples and project layout
- [x] Decide how classifier categories map to demo departments (geodezja, drogi)

## 1. Backend (FastAPI)
- [x] Add FastAPI + uvicorn deps to pyproject.toml
- [x] Create `backend/app/` package (main.py, schemas, classify route, config)
- [x] `GET /health` health check
- [x] `POST /classify` — accept document text/payload, call existing `classify()`, return department + confidence + reason
- [x] Map classifier category -> department (incl. drogi mapping)
- [x] Read `DEMO_ENV` flag on backend; expose via `GET /config`
- [~] Demo doc->employee map lives in frontend (deterministic) — backend stays minimal
- [x] Enable CORS for Vite dev server
- [x] Verify backend imports + classify route works (health/config tested without LM Studio)

## 2. Frontend scaffold (Vite + React + TS)
- [x] Scaffold Vite React-TS app in `frontend/`
- [x] Install deps: @xyflow/react
- [x] App shell with nav: Flow Editor / Departments / Employees
- [x] Env handling: VITE_DEMO_ENV + API base URL (env.ts, .env.example)
- [x] Simple clean CSS

## 3. Data/service layer (mock, swappable)
- [x] Types: Department, Team, Employee
- [x] Seed mock data (geodezja, drogi + teams + employees)
- [x] `departmentService` (async CRUD over in-memory)
- [x] `employeeService` (async CRUD over in-memory + candidates)
- [x] `classifyService` (calls backend /classify + /config + /extract + /run-flow)
- [x] Isolate demo data (4 sample docs, doc->employee map, mock diagram JSON)

## 4. Flow-diagram editor (React Flow)
- [x] Custom node types: Document, Classifier, (Department→Class), TeamCondition, PersonCondition, Employee
- [x] Add / connect / rename / delete elements
- [x] Pan/zoom (built-in)
- [x] Export / import flow JSON
- [x] Demo: auto-load preloaded mock diagram on startup
- [x] Run action -> calls backend, shows resolved result
- [x] Demo: deterministic doc->employee resolution shown

## 5. Departments registry UI
- [x] List view
- [x] Add / edit / delete (with teams[])
- [x] Wired to departmentService

## 6. Employees registry UI
- [x] List view
- [x] Add / edit / delete (id, fullName, departmentId, team, skills[], active)
- [x] Wired to employeeService

## 7. Wiring & demo mode
- [x] 4 fixed sample documents preloaded + selectable
- [x] Hardcoded doc->employee assignment map (demo)
- [x] Classification step visible, final assignment from map in demo
- [x] Candidate employees by resolved dept+team (nice-to-have)

## 8. Docs & self-review
- [x] README section: how to run demo + where mock data lives
- [x] Self-review: backend responds (mock + live e2e), frontend builds + dev runs,
      all 3 areas implemented, classify wired from UI, DEMO_ENV deterministic. 16 existing tests pass.

## 9. Graph-driven classification (diagram becomes executable)
Idea: each classifier node defines a condition/instruction + classifies into a set
of classes (strict). Backend walks the graph node-to-node, building the prompt per
node from the diagram, following the chosen branch until a terminal (Employee)
node. Decision: backend walks the whole graph.
> Note: this section's original "classes = outgoing edge labels" model was
> **superseded by Part 12** (classes live on dedicated output/class blocks).

### 9a. Classifier core (additive, non-breaking)
- [x] Add `classify_into(payloads, classes, instruction)` to classifier.py — builds prompt dynamically from passed classes + instruction
- [x] Dynamic-class validation via DynamicClassification + normalise_category (not pinned to config.CATEGORIES)
- [x] Keep existing `classify()` + `/classify` working unchanged

### 9b. Backend graph execution
- [x] Schemas: FlowNode, FlowEdge, RunFlowRequest, RunFlowStep, RunFlowResponse
- [x] `POST /run-flow` (backend/app/graph.py): find start, build classes, classify, follow chosen branch, stop at terminal
- [x] Return full traversal (per-step) + final node + path node/edge ids
- [x] Guardrails: no-start, dead-end class, cycle bound (50)

### 9c. Frontend node data model + editing
- [x] Extend node data: { label, instruction } — flowTypes.ts
- [x] Node-editor side panel (NodeEditor.tsx): edit name + instruction; show "classifies into"
- [x] Validation warnings in UI

### 9d. Frontend run + visualize
- [x] "Uruchom przepływ" action -> POST /run-flow with serialized diagram + document (RunPanel.tsx)
- [x] Highlight traversed path (green nodes + animated edges) and per-step result list
- [x] End on resolved terminal node; demo deterministic assignment shown

### 9e. Demo data enrichment
- [x] demoFlow.ts: real Polish instruction per node + classes

## 10. Polish-language UI
- [x] Translate UI strings to Polish (nav, buttons, forms, tables, panels, alerts)
- [x] Node kind labels + toolbar in Polish
- [x] Code identifiers/types stay English; only user-facing text Polish
- [x] Set <html lang="pl">

## 11. Re-verify
- [x] Frontend builds clean (tsc + vite)
- [x] Backend imports + /run-flow works with mocked classifier AND live LM Studio
- [x] Existing 16 tests still pass

## 12. Refactor: output/class blocks (replace label-on-edge model)
Decision: classes live on dedicated OUTPUT (class) blocks, not on edges. A
classifier node's classes = labels of the class-nodes it connects to; the chosen
class-node then flows onward to the next classifier/terminal. Edges = plain
connectors. Replaces the Part-9 label-on-edge model; demo flow rewritten.

### 12a. Backend
- [x] graph.py: at a node, gather connected `class` nodes -> their labels are the classes
- [x] Classify, pick matching class node, then step THROUGH it to its onward target
- [x] Drop edge-label semantics; edges are plain connectors
- [x] Guardrails: multi plain-connection w/o class blocks, class node w/ >1 onward edge, dead-ends, cycle bound
- [x] Path includes classifier + chosen class node + onward node

### 12b. Frontend
- [x] Add `class` (output) node type to nodeTypes (Polish: „Klasa (wyjście)”); replaced `department`
- [x] NodeEditor: non-terminal shows "classifies into" = connected class-node labels; class node edits its name
- [x] Drop edge-label editing (edges are plain); removed double-click edge label + onConnect prompt
- [x] RunPanel/highlight works with new path

### 12c. Demo data
- [x] Rewrite demoFlow.ts using output blocks: Klasyfikuj -> [geodezja][drogi] -> Warunek zespołu -> [zespół 1][zespół 2] -> Warunek osoby -> Pracownik
- [x] Fix bug: distinct branches go to distinct nodes (no two edges to same target)
- [x] Person-condition flows straight to employee (no spurious single-class step)

### 12d. Robustness
- [x] Diacritic-insensitive class matching (_fold) so models dropping Polish diacritics (zespol vs zespół) still match — incl. stroked Ł

### 12e. Re-verify
- [x] Frontend builds clean
- [x] Backend /run-flow works (mock + live LM Studio) with block model — reaches Pracownik end-to-end
- [x] Existing 16 tests pass

## 13. File drop-zone input (replace free-text box)
Non-demo input should be a drag-and-drop file area, not a textarea.
- [x] Backend `POST /extract`: UploadFile -> sid_beta.ingest -> ExtractResponse {text, document_name, image_pages}
- [x] Validate extension (.pdf/.docx/.png/.jpg/.jpeg); 415 unsupported, 422 unreadable/scanned-no-text
- [x] classifyService.extract(file) via multipart FormData
- [x] DropZone component (drag/drop + click-to-pick, busy/loaded states, Polish)
- [x] RunPanel non-demo path uses DropZone -> extracted text -> /run-flow
- [x] Dropzone CSS
- [x] Verified end-to-end: drop real PDF -> /extract -> /run-flow classified live (PB-2.pdf -> drogi 0.95)

## 14. Backend config via pydantic-settings
- [x] BackendSettings(BaseSettings) loads DEMO_ENV + CORS origins from root `.env` (env vars take precedence)
- [x] CORS defaults cover Vite ports 5173-5175
- [x] DEMO_ENV moved to root `.env`; removed misleading backend/.env; updated backend/.env.example
- [x] Consolidated env docs into root `.env.example`; removed backend/.env.example

## 15. Restructure into self-contained backend + dockerize
Decision: fold the classifier into one package `app` (core = `app.sid_beta`) under
`backend/`, so the backend is self-contained for Docker. Frontend = multi-stage
nginx image serving the static build and proxying /api to the backend.

### 15a. Relocate Python into backend/
- [x] Move src/sid_beta -> backend/app/sid_beta
- [x] Move tests/ -> backend/tests; move samples/ -> backend/samples
- [x] Move pyproject.toml + uv.lock + .python-version -> backend/ ; flat package `app` (uv build-backend module-name/root)
- [x] Update imports: `sid_beta.X` -> `app.sid_beta.X` (backend/app + tests)
- [x] [project.scripts] sid-beta = app.sid_beta:main; pytest pythonpath="."
- [x] Both settings classes load backend/.env by ABSOLUTE path (CWD-independent)
- [x] samples/ path resolution still correct after moves (no edits needed)
- [x] `uv sync` in backend/ green; `uv run pytest` 16 passed (incl. live e2e)
- [x] Backend runs: uvicorn app.main:app -> /health + /config OK

### 15b. Backend Dockerfile
- [x] backend/Dockerfile (python:3.13-slim + uv from ghcr, frozen sync, copy app + samples)
- [x] Install Poppler (poppler-utils) in image for scanned PDFs
- [x] EXPOSE 8000; CMD uvicorn app.main:app --host 0.0.0.0 --port 8000
- [x] backend/.dockerignore (.venv, __pycache__, tests, .env)
- [x] LM Studio on host -> SID_BASE_URL=http://host.docker.internal:1234/v1 (set in compose)

### 15c. Frontend Dockerfile
- [x] frontend/Dockerfile multi-stage: node build -> nginx serve dist/
- [x] nginx.conf: SPA fallback + proxy /api/ -> backend:8000 (+ 25m upload cap)
- [x] Frontend API base -> /api (VITE_API_BASE_URL set in Dockerfile build)
- [x] frontend/.dockerignore (node_modules, dist, .env)

### 15d. Compose + docs
- [x] docker-compose.yml: backend + frontend, env, host.docker.internal mapping
- [x] Update README + CLAUDE.md layout/commands for new structure + Docker
- [~] Verify `docker compose up`: compose config validates; full image build pending
      (Docker daemon was not running in this session — build/run untested)
