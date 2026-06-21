"""Structured output schema for classification results."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from .config import CATEGORIES


class Classification(BaseModel):
    """The structured result the model must return for one document."""

    category: str = Field(
        description="The predicted document category. Must be one of the allowed categories.",
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the predicted category, from 0.0 to 1.0.",
    )
    reason: str = Field(
        description="A short rationale (one or two sentences) for the chosen category.",
    )

    @field_validator("category")
    @classmethod
    def _category_must_be_known(cls, value: str) -> str:
        # Keep the taxonomy defined in one place (config.CATEGORIES) rather than
        # duplicating it as a Literal/Enum here. Match case-insensitively and
        # normalise to the canonical spelling.
        for known in CATEGORIES:
            if value.strip().lower() == known.lower():
                return known
        raise ValueError(
            f"category {value!r} is not one of the allowed categories: {CATEGORIES}"
        )
