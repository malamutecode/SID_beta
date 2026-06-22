"""Graph execution: walk a serialized routing diagram over one document.

The diagram is *executable*. Classes live on dedicated **output (class) blocks**,
not on edges. A node is a *classification point* when its direct successors
include ``class`` nodes: those class nodes' labels are the allowed classes. We
build a prompt from the classifier node's ``instruction`` plus those classes,
classify the document, pick the matching class node, then step *through* it to
its onward target, continuing until we reach a terminal node (no successors).

Edges are plain connectors — they carry no classification meaning.
"""

from __future__ import annotations

from app.sid_beta.classifier import classify_into

from .schemas import (
    FlowEdge,
    FlowNode,
    RunFlowRequest,
    RunFlowResponse,
    RunFlowStep,
)

# Safety bound so a cyclic/misbuilt diagram can't loop forever.
_MAX_STEPS = 50

# Node type that declares a single class (its label is the class name).
_CLASS_TYPE = "class"


class GraphError(Exception):
    """Raised when the diagram cannot be executed."""


def _node_label(node: FlowNode) -> str:
    label = node.data.get("label")
    return str(label) if label else (node.type or node.id)


def _find_start(nodes: list[FlowNode], edges: list[FlowEdge]) -> FlowNode:
    """Entry node: a 'document' node if present, else any node with no incoming edge."""
    for n in nodes:
        if n.type == "document":
            return n
    targets = {e.target for e in edges}
    starts = [n for n in nodes if n.id not in targets]
    if starts:
        return starts[0]
    raise GraphError("could not determine a start node (no document node, no source-only node)")


def run_flow(req: RunFlowRequest) -> RunFlowResponse:
    """Walk the diagram, classifying wherever a node points at class blocks."""
    if not req.nodes:
        raise GraphError("diagram has no nodes")

    by_id = {n.id: n for n in req.nodes}
    # Outgoing edges per node, as (edge, target-node) pairs.
    out_edges: dict[str, list[FlowEdge]] = {n.id: [] for n in req.nodes}
    for e in req.edges:
        if e.source in out_edges and e.target in by_id:
            out_edges[e.source].append(e)

    payloads = [req.text]
    steps: list[RunFlowStep] = []
    path_node_ids: list[str] = []
    path_edge_ids: list[str] = []

    def finish(node: FlowNode) -> RunFlowResponse:
        return RunFlowResponse(
            steps=steps,
            final_node_id=node.id,
            final_node_label=_node_label(node),
            path_node_ids=path_node_ids,
            path_edge_ids=path_edge_ids,
        )

    current = _find_start(req.nodes, req.edges)
    path_node_ids.append(current.id)

    for _ in range(_MAX_STEPS):
        edges_out = out_edges.get(current.id, [])
        if not edges_out:
            return finish(current)  # terminal node

        # Class blocks among the direct successors define this node's classes.
        class_edges = [e for e in edges_out if by_id[e.target].type == _CLASS_TYPE]

        if not class_edges:
            # Not a classification point: a plain pass-through (e.g. Document ->
            # Classifier). Follow the single connector onward.
            if len(edges_out) == 1:
                edge = edges_out[0]
                path_edge_ids.append(edge.id)
                current = by_id[edge.target]
                path_node_ids.append(current.id)
                continue
            raise GraphError(
                f"node {_node_label(current)!r} has multiple plain connections and no "
                "output (class) blocks to classify into"
            )

        # Classify into the connected class blocks' labels.
        classes = [_node_label(by_id[e.target]) for e in class_edges]
        instruction = str(current.data.get("instruction", "") or "")
        result = classify_into(payloads, classes, instruction)

        chosen_edge = next(
            (
                e
                for e in class_edges
                if _node_label(by_id[e.target]).strip().lower()
                == result.category.strip().lower()
            ),
            None,
        )
        class_node = by_id[chosen_edge.target] if chosen_edge else None
        steps.append(
            RunFlowStep(
                node_id=current.id,
                node_label=_node_label(current),
                classes=classes,
                chosen_class=result.category,
                confidence=result.confidence,
                reason=result.reason,
                next_node_id=class_node.id if class_node else None,
            )
        )

        if chosen_edge is None or class_node is None:
            # Model picked a class with no matching block — stop and report.
            return finish(current)

        # Step onto the chosen class block.
        path_edge_ids.append(chosen_edge.id)
        path_node_ids.append(class_node.id)

        # Then flow onward from the class block to the next stage. A class block
        # with no onward edge is itself the end of this branch.
        onward = out_edges.get(class_node.id, [])
        if not onward:
            return finish(class_node)
        if len(onward) > 1:
            raise GraphError(
                f"output block {_node_label(class_node)!r} has more than one onward "
                "connection; it must lead to a single next step"
            )
        nxt = onward[0]
        path_edge_ids.append(nxt.id)
        current = by_id[nxt.target]
        path_node_ids.append(current.id)

    raise GraphError(f"diagram traversal exceeded {_MAX_STEPS} steps (cycle?)")
