"""Request/response models for the backend API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ClassifyRequest(BaseModel):
    """A classification request.

    For the demo the frontend sends document text (the 4 sample documents are
    plain text). ``document_name`` is optional and only used so the backend can
    echo it back / drive the demo's deterministic mapping if desired.
    """

    text: str = Field(min_length=1, description="The document text to classify.")
    document_name: str | None = Field(
        default=None, description="Optional source document name (for display/demo)."
    )


class ClassifyResponse(BaseModel):
    """The resolved routing result for a document."""

    category: str = Field(description="Raw classifier category.")
    department: str = Field(description="Routing department resolved from the category.")
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str = Field(description="Short rationale from the classifier.")
    document_name: str | None = None


class ConfigResponse(BaseModel):
    """Runtime config surfaced to the frontend."""

    demo_env: bool
    departments: list[str]


class ExtractResponse(BaseModel):
    """Text extracted from an uploaded document file."""

    text: str = Field(description="Extracted plain text, ready to classify.")
    document_name: str = Field(description="Original uploaded file name.")
    # Number of image (scanned/photo) pages that were OCR-read by the VLM and
    # whose text could not be returned as plain text (informational).
    image_pages: int = Field(
        default=0, description="Image-only pages that yield no extractable text."
    )


# --- Graph execution (the diagram is executable) -----------------------------


class FlowNode(BaseModel):
    """A diagram node as serialized by the frontend (React Flow)."""

    id: str
    type: str | None = None
    data: dict = Field(default_factory=dict)  # { label, instruction? }


class FlowEdge(BaseModel):
    """A diagram edge. ``label`` is the output class for the source node."""

    id: str
    source: str
    target: str
    label: str | None = None


class RunFlowRequest(BaseModel):
    """Run a serialized diagram over one document."""

    nodes: list[FlowNode]
    edges: list[FlowEdge]
    text: str = Field(min_length=1, description="The document text to route.")
    document_name: str | None = None


class RunFlowStep(BaseModel):
    """One classification step taken while walking the graph."""

    node_id: str
    node_label: str
    classes: list[str]  # the allowed classes at this node (outgoing edge labels)
    chosen_class: str
    confidence: float
    reason: str
    next_node_id: str | None = None


class RunFlowResponse(BaseModel):
    """The full traversal result."""

    steps: list[RunFlowStep]
    final_node_id: str | None = None
    final_node_label: str | None = None
    # Path of node ids visited, for highlighting in the UI.
    path_node_ids: list[str] = Field(default_factory=list)
    path_edge_ids: list[str] = Field(default_factory=list)
    # Demo-only deterministic assignment passthrough (filled by the frontend).
    assigned_employee_id: str | None = None
