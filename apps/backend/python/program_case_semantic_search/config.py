from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from .errors import ConfigurationError

PROVIDER = "LOCAL_SENTENCE_TRANSFORMERS"
MODEL_ID = "nlpai-lab/KURE-v1"
MODEL_REVISION = "d14c8a9423946e268a0c9952fecf3a7aabd73bd9"
MODEL_DIMENSION = 1024
NORMALIZE_EMBEDDINGS = True
EMBEDDING_VERSION = f"kure-v1-1024-l2-{MODEL_REVISION[:12]}"
DEFAULT_BATCH_SIZE = 8
MIN_BATCH_SIZE = 1
MAX_BATCH_SIZE = 32
DEFAULT_SEARCH_LIMIT = 5
MAX_SEARCH_LIMIT = 20
MAX_QUERY_CHARACTERS = 1000
PROCESSING_RECOVERY_MINUTES = 30
BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
ALLOWED_WORKSPACE_CACHE = (BACKEND_DIRECTORY / ".model-cache").resolve()

# libpq/psycopg parameters. Prisma/adapter-only options are deliberately dropped.
_ALLOWED_QUERY_PARAMETERS = {
    "application_name", "channel_binding", "connect_timeout", "gssencmode",
    "hostaddr", "keepalives", "keepalives_count", "keepalives_idle",
    "keepalives_interval", "options", "passfile", "requirepeer",
    "service", "servicefile", "sslcert", "sslcrl", "sslkey", "sslmode",
    "sslpassword", "target_session_attrs",
}


def validate_batch_size(value: int) -> int:
    if not MIN_BATCH_SIZE <= value <= MAX_BATCH_SIZE:
        raise ConfigurationError(
            f"batch size must be between {MIN_BATCH_SIZE} and {MAX_BATCH_SIZE}"
        )
    return value


def sanitize_database_url(url: str) -> str:
    """Preserve libpq options and remove only known-incompatible query options."""
    try:
        parts = urlsplit(url)
    except ValueError as exc:
        raise ConfigurationError("DATABASE_URL is not a valid URL") from exc
    if parts.scheme not in {"postgresql", "postgres"} or not parts.hostname:
        raise ConfigurationError("DATABASE_URL must be a PostgreSQL URL")
    query = [(key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True)
             if key in _ALLOWED_QUERY_PARAMETERS]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def validate_model_cache_dir(value: str) -> Path:
    cache = Path(value).expanduser().resolve()
    try:
        cache.relative_to(BACKEND_DIRECTORY)
    except ValueError:
        return cache
    if cache != ALLOWED_WORKSPACE_CACHE:
        raise ConfigurationError(
            "KURE_MODEL_CACHE_DIR inside apps/backend must be apps/backend/.model-cache"
        )
    return cache


@dataclass(frozen=True)
class Settings:
    database_url: str = field(repr=False)
    batch_size: int = DEFAULT_BATCH_SIZE
    model_cache_dir: Path | None = None

    @classmethod
    def from_environment(cls, *, require_database: bool = True) -> "Settings":
        database_url = os.getenv("DATABASE_URL", "").strip()
        if require_database and not database_url:
            raise ConfigurationError("DATABASE_URL is required")
        try:
            batch_size = validate_batch_size(int(os.getenv("KURE_BATCH_SIZE", DEFAULT_BATCH_SIZE)))
        except ValueError as exc:
            raise ConfigurationError("KURE_BATCH_SIZE must be an integer") from exc
        cache = os.getenv("KURE_MODEL_CACHE_DIR", "").strip()
        return cls(
            database_url=sanitize_database_url(database_url) if database_url else "",
            batch_size=batch_size,
            model_cache_dir=validate_model_cache_dir(cache) if cache else None,
        )
