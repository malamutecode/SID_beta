"""Structured output schema for classification results."""

from __future__ import annotations

import unicodedata

from pydantic import BaseModel, Field, field_validator

from .config import CATEGORIES


# Letters that NFKD does NOT decompose into base + combining mark (notably the
# Polish stroked L). Mapped explicitly so e.g. ``zespol`` matches ``zespół``.
_SPECIAL_FOLD = str.maketrans({"ł": "l", "Ł": "L", "đ": "d", "Đ": "D", "ø": "o", "Ø": "O"})


def _fold(s: str) -> str:
    """Normalise for matching: strip accents, lowercase, collapse whitespace.

    Local models sometimes drop Polish diacritics (e.g. ``zespol`` for
    ``zespół``); folding lets such answers still match the canonical class.
    """
    s = s.translate(_SPECIAL_FOLD)
    decomposed = unicodedata.normalize("NFKD", s)
    no_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(no_accents.lower().split())


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


class DynamicClassification(BaseModel):
    """Classification result whose allowed classes are supplied at runtime.

    Used by graph execution, where the classes come from the diagram (a node's
    outgoing edge labels) rather than the fixed ``config.CATEGORIES``. The
    category is therefore *not* validated at construction; call
    :meth:`normalise_category` with the node's class list after the LLM responds.
    """

    category: str = Field(
        description="The predicted class. Must be one of the classes given in the prompt.",
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the predicted class, from 0.0 to 1.0.",
    )
    reason: str = Field(
        description="A short rationale (one or two sentences) for the chosen class.",
    )

    def normalise_category(self, classes: list[str]) -> None:
        """Snap ``category`` to the canonical spelling of a known class.

        Matches accent- and case-insensitively (see :func:`_fold`). If the model
        returns something not in ``classes``, leave the raw value as-is (the graph
        walker treats an unmatched class as a dead end) so a misbehaving model
        degrades gracefully instead of raising mid-traversal.
        """
        folded = _fold(self.category)
        for known in classes:
            if folded == _fold(known):
                self.category = known
                return
