FROM python:3.13-slim

ARG INSTALL_AI=false

WORKDIR /app

# Install git (required for pip install from git URLs) and uv
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv

# Install openbuildingstack from GitHub
RUN uv pip install --system "openbuildingstack @ git+https://github.com/C4SBF/obs-python.git"

# Copy project files and install remaining dependencies
COPY pyproject.toml ./
COPY main.py endpoints.py ./
RUN uv pip install --system BAC0 fastapi "uvicorn[standard]" pydantic PyYAML

# Optionally install AI dependencies (torch CPU-only + transformers)
RUN if [ "$INSTALL_AI" = "true" ]; then \
        uv pip install --system \
            --extra-index-url https://download.pytorch.org/whl/cpu \
            "torch>=2.0.0" "transformers>=4.35.0" "accelerate>=0.24.0"; \
    fi

ENV PYTHONUNBUFFERED=1
ENV HF_TOKEN=""
ENV HF_HUB_DISABLE_PROGRESS_BARS=1

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
