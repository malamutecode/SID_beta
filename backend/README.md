# sid_beta backend

FastAPI service wrapping the `sid_beta` local-LLM document classifier.

The importable package is **`app`**:
- `app/` — FastAPI app (`main.py`), graph executor (`graph.py`), schemas, config.
- `app/sid_beta/` — the classifier core (Pydantic AI + LM Studio, ingestion).

## Run (from this `backend/` directory)

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000   # API on http://localhost:8000
uv run pytest                                       # tests (e2e auto-skip if LM Studio down)
uv run sid-beta                                     # classifier CLI over samples/
```

Settings load from `../.env` (project root) or real env vars. See the root
`.env.example` and [../CLAUDE.md](../CLAUDE.md). LM Studio must be running with a
vision model loaded. Docker: see [../README.md](../README.md).
