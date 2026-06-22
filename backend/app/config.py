"""Backend configuration.

Reads the demo flag and the category->department routing map. Kept separate from
the classifier's own ``sid_beta.config`` so the demo layer can evolve without
touching the classification core.
"""

from __future__ import annotations

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Vite serves on 5173 by default, but falls back to 5174/5175 when that port is
# taken — so allow the common range to avoid CORS "Failed to fetch" surprises.
_DEFAULT_ORIGINS = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:5174,http://127.0.0.1:5174,"
    "http://localhost:5175,http://127.0.0.1:5175"
)


class BackendSettings(BaseSettings):
    """Backend runtime settings, loadable from the environment or a ``.env`` file.

    Loaded from ``.env`` in the working directory (alongside real environment
    variables, which take precedence). Set ``DEMO_ENV=true`` there once instead of
    exporting it on every launch.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # DEMO_ENV is surfaced to both backend and frontend. When true, the app runs
    # the fixed, predictable end-to-end scenario (sample docs, hardcoded
    # assignment, preloaded diagram). Bare env var name (no SID_ prefix).
    demo_env: bool = Field(default=False, validation_alias="DEMO_ENV")

    # CORS origins allowed to call the API. Accepts a comma-separated string.
    allowed_origins: list[str] = Field(
        default_factory=lambda: _split_origins(_DEFAULT_ORIGINS),
        validation_alias=AliasChoices("SID_ALLOWED_ORIGINS", "ALLOWED_ORIGINS"),
    )

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _parse_origins(cls, value: object) -> object:
        # Allow the env var to be a comma-separated string.
        if isinstance(value, str):
            return _split_origins(value)
        return value


def _split_origins(raw: str) -> list[str]:
    return [o.strip() for o in raw.split(",") if o.strip()]


settings = BackendSettings()

# Module-level aliases kept for existing imports (main.py).
DEMO_ENV: bool = settings.demo_env
ALLOWED_ORIGINS: list[str] = settings.allowed_origins

# Maps a classifier *category* (from sid_beta.config.CATEGORIES) to a *department*
# in the routing demo. The demo's departments are geodezja and drogi; the existing
# taxonomy doesn't have "drogi", so building-related categories are routed there as
# a stand-in. This keeps the classifier untouched while letting the demo speak in
# terms of departments. Edit here to re-point the routing.
CATEGORY_TO_DEPARTMENT: dict[str, str] = {
    "geodezja": "geodezja",
    "zgloszenia budowlane": "drogi",
    "podatki": "drogi",
    "umowa B2B": "drogi",
}

# Fallback department when a category has no explicit mapping.
DEFAULT_DEPARTMENT: str = "geodezja"


def resolve_department(category: str) -> str:
    """Map a classifier category to a routing department."""
    return CATEGORY_TO_DEPARTMENT.get(category, DEFAULT_DEPARTMENT)
