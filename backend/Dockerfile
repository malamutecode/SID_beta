# Backend image: FastAPI + the sid_beta classifier core.
# Uses uv for dependency management. Poppler is installed for scanned-PDF support.
FROM python:3.13-slim

# Poppler (pdftoppm) is needed by pdf2image to rasterize scanned PDFs. Drop this
# block if you never ingest scanned/image-only PDFs and want a smaller image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# uv: fast, reproducible installs from uv.lock.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install dependencies first (cached layer) using only the lock + manifest.
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-install-project --no-dev

# Copy the application source and the sample documents.
COPY app ./app
COPY samples ./samples

# Install the project itself (the `app` package) into the environment.
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000

# LM Studio runs on the host: set SID_BASE_URL=http://host.docker.internal:1234/v1
# (and DEMO_ENV, etc.) via env or an env_file at run time.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
