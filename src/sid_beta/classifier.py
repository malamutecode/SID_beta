"""The classifier agent: build a Pydantic AI Agent against LM Studio and run it."""

from __future__ import annotations

from functools import lru_cache

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from .config import CATEGORIES, settings
from .ingest import Payload
from .models import Classification


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
