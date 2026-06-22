"""The classifier agent: build a Pydantic AI Agent against LM Studio and run it."""

from __future__ import annotations

from functools import lru_cache

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from .config import CATEGORIES, settings
from .ingest import Payload
from .models import Classification, DynamicClassification


def _system_prompt() -> str:
    categories = "\n".join(f"- {c}" for c in CATEGORIES)
    return (
        "You are a document classification assistant. You receive the contents "
        "of a single document, either as extracted text or as page images. "
        "Read it (perform OCR on images if needed) and classify it into exactly "
        "one of the following categories:\n"
        f"{categories}\n\n"
        "Respond with the chosen category (use the exact category text above), a "
        "confidence between 0 and 1, and a short reason. If unsure, pick the "
        "closest category and lower the confidence."
    )


def _dynamic_system_prompt(classes: list[str], instruction: str) -> str:
    """Build a classification prompt from a single graph node's definition.

    ``classes`` are the allowed output labels (the node's outgoing edge labels);
    ``instruction`` is the user-authored condition describing how to choose.
    """
    options = "\n".join(f"- {c}" for c in classes)
    extra = f"\n\nClassification condition (from the diagram):\n{instruction}" if instruction.strip() else ""
    return (
        "You are a document classification assistant. You receive the contents "
        "of a single document, either as extracted text or as page images. "
        "Read it (perform OCR on images if needed) and classify it into exactly "
        "one of the following classes:\n"
        f"{options}"
        f"{extra}\n\n"
        "Respond with the chosen class (use the exact class text above), a "
        "confidence between 0 and 1, and a short reason. If unsure, pick the "
        "closest class and lower the confidence."
    )


@lru_cache(maxsize=1)
def build_agent() -> Agent[None, Classification]:
    """Build (and cache) the classification agent pointed at LM Studio."""
    model = OpenAIChatModel(
        settings.model_name,
        provider=OpenAIProvider(base_url=settings.base_url, api_key=settings.api_key),
    )
    return Agent(
        model,
        output_type=Classification,
        system_prompt=_system_prompt(),
    )


def _cap_text(payloads: list[Payload]) -> list[Payload]:
    """Truncate the combined extracted text to stay within the context window.

    Image payloads are passed through untouched; only text is trimmed. The cap
    is applied across the concatenated text so multi-page documents don't blow
    past a small local context.
    """
    limit = settings.max_text_chars
    if limit <= 0:
        return payloads
    remaining = limit
    capped: list[Payload] = []
    for p in payloads:
        if isinstance(p, str):
            if remaining <= 0:
                continue
            capped.append(p[:remaining])
            remaining -= len(p)
        else:
            capped.append(p)
    return capped


def classify(payloads: list[Payload]) -> Classification:
    """Classify one document given its ingested text/image payloads."""
    if not payloads:
        raise ValueError("no payloads to classify")
    agent = build_agent()
    user_input: list[Payload] = ["Classify this document.", *_cap_text(payloads)]
    result = agent.run_sync(user_input)
    return result.output


def _build_dynamic_agent(
    classes: tuple[str, ...], instruction: str
) -> Agent[None, DynamicClassification]:
    """Build a one-off classification agent for a single graph node.

    Not cached on the class list: graph nodes differ, so each step gets its own
    agent. The model/provider construction is cheap relative to the LLM call.
    """
    model = OpenAIChatModel(
        settings.model_name,
        provider=OpenAIProvider(base_url=settings.base_url, api_key=settings.api_key),
    )
    return Agent(
        model,
        output_type=DynamicClassification,
        system_prompt=_dynamic_system_prompt(list(classes), instruction),
    )


def classify_into(
    payloads: list[Payload], classes: list[str], instruction: str = ""
) -> DynamicClassification:
    """Classify a document into one of ``classes`` per a node's ``instruction``.

    This is the graph-execution primitive: the allowed classes come from the
    diagram (a node's outgoing edge labels) rather than the global taxonomy. The
    returned ``category`` is validated against ``classes`` (case-insensitive,
    normalised to the canonical spelling).
    """
    if not payloads:
        raise ValueError("no payloads to classify")
    if not classes:
        raise ValueError("no classes to classify into")
    agent = _build_dynamic_agent(tuple(classes), instruction)
    user_input: list[Payload] = ["Classify this document.", *_cap_text(payloads)]
    result = agent.run_sync(user_input)
    out = result.output
    out.normalise_category(classes)
    return out
