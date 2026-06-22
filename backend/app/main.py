"""FastAPI app: wraps the existing local-LLM classifier behind a REST API.

Endpoints:
- ``GET  /health``   -> liveness probe
- ``GET  /config``   -> demo flag + departments (for the frontend)
- ``POST /classify`` -> classify document text, return resolved department

The classification core lives in ``sid_beta`` and is imported unchanged.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.sid_beta.classifier import classify
from app.sid_beta.ingest import IngestError, ingest

from .config import ALLOWED_ORIGINS, DEMO_ENV, resolve_department
from .graph import GraphError, run_flow
from .schemas import (
    ClassifyRequest,
    ClassifyResponse,
    ConfigResponse,
    ExtractResponse,
    RunFlowRequest,
    RunFlowResponse,
)

# Departments exposed to the frontend (derived from the routing map's values).
from .config import CATEGORY_TO_DEPARTMENT

DEPARTMENTS = sorted(set(CATEGORY_TO_DEPARTMENT.values()))

app = FastAPI(title="sid_beta document routing", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/config", response_model=ConfigResponse)
def get_config() -> ConfigResponse:
    return ConfigResponse(demo_env=DEMO_ENV, departments=DEPARTMENTS)


@app.post("/classify", response_model=ClassifyResponse)
def classify_document(req: ClassifyRequest) -> ClassifyResponse:
    """Classify document text via the local LLM and resolve to a department."""
    try:
        result = classify([req.text])
    except Exception as exc:  # connection / model / parsing errors
        raise HTTPException(
            status_code=502,
            detail=f"classification failed (is LM Studio running?): {exc}",
        ) from exc

    return ClassifyResponse(
        category=result.category,
        department=resolve_department(result.category),
        confidence=result.confidence,
        reason=result.reason,
        document_name=req.document_name,
    )


# File extensions the ingest layer understands (mirrors sid_beta.ingest).
_SUPPORTED_SUFFIXES = {".pdf", ".docx", ".png", ".jpg", ".jpeg"}


@app.post("/extract", response_model=ExtractResponse)
async def extract_document(file: UploadFile = File(...)) -> ExtractResponse:
    """Extract plain text from an uploaded document (PDF / .docx / image).

    Reuses the existing ``sid_beta.ingest`` layer. Text payloads are concatenated
    and returned; image-only pages (scanned PDFs / photos) cannot be returned as
    text here and are reported via ``image_pages`` (use a text PDF or .docx for
    the drop-zone flow). The returned text is what the frontend then runs through
    the diagram.
    """
    name = file.filename or "document"
    suffix = Path(name).suffix.lower()
    if suffix not in _SUPPORTED_SUFFIXES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"unsupported file type {suffix!r}; allowed: "
                f"{', '.join(sorted(_SUPPORTED_SUFFIXES))}"
            ),
        )

    data = await file.read()
    # Ingest works on a path; write to a temp file with the right suffix.
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = Path(tmp.name)
    try:
        payloads = ingest(tmp_path)
    except IngestError as exc:
        raise HTTPException(status_code=422, detail=f"could not read document: {exc}") from exc
    finally:
        tmp_path.unlink(missing_ok=True)

    text_parts = [p for p in payloads if isinstance(p, str)]
    image_pages = sum(1 for p in payloads if not isinstance(p, str))
    text = "\n\n".join(text_parts).strip()

    if not text:
        raise HTTPException(
            status_code=422,
            detail=(
                "no extractable text in this document"
                + (" (it looks scanned/image-only)" if image_pages else "")
                + "; the drop-zone flow needs a text PDF or .docx"
            ),
        )

    return ExtractResponse(text=text, document_name=name, image_pages=image_pages)


@app.post("/run-flow", response_model=RunFlowResponse)
def run_flow_endpoint(req: RunFlowRequest) -> RunFlowResponse:
    """Execute a serialized routing diagram over the document text.

    Walks the graph node-to-node, building each node's prompt from its
    instruction + outgoing edge labels (the allowed classes), and returns the
    full traversal so the UI can highlight the path and show each decision.
    """
    try:
        return run_flow(req)
    except GraphError as exc:
        raise HTTPException(status_code=400, detail=f"invalid diagram: {exc}") from exc
    except Exception as exc:  # connection / model / parsing errors
        raise HTTPException(
            status_code=502,
            detail=f"flow execution failed (is LM Studio running?): {exc}",
        ) from exc
