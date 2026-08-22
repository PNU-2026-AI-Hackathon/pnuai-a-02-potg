from __future__ import annotations

import os
from urllib.parse import unquote, urlsplit

from .config import sanitize_database_url
from .errors import ConfigurationError

TEST_DATABASE_MARKERS = ("test", "integration")


def _database_name(url: str, variable_name: str) -> str:
    try:
        parts = urlsplit(url)
    except ValueError as exc:
        raise ConfigurationError(f"{variable_name} is not a valid URL") from exc
    if parts.scheme not in {"postgresql", "postgres"} or not parts.hostname:
        raise ConfigurationError(f"{variable_name} must be a PostgreSQL URL")
    database_name = unquote(parts.path.lstrip("/")).strip()
    if not database_name or "/" in database_name:
        raise ConfigurationError(f"{variable_name} must include one database name")
    return database_name


def validate_test_database_url(
    test_database_url: str | None,
    production_database_url: str | None,
) -> str:
    """Validate test identity without opening a network connection."""
    test_url = (test_database_url or "").strip()
    production_url = (production_database_url or "").strip()
    if not test_url:
        raise ConfigurationError("TEST_DATABASE_URL is required")
    test_name = _database_name(test_url, "TEST_DATABASE_URL")
    if not any(marker in test_name.lower() for marker in TEST_DATABASE_MARKERS):
        raise ConfigurationError(
            "TEST_DATABASE_URL database name must contain test or integration"
        )
    if production_url:
        if test_url == production_url:
            raise ConfigurationError("TEST_DATABASE_URL must differ from DATABASE_URL")
        production_name = _database_name(production_url, "DATABASE_URL")
        if test_name.casefold() == production_name.casefold():
            raise ConfigurationError(
                "TEST_DATABASE_URL database name must differ from DATABASE_URL"
            )
    return sanitize_database_url(test_url)


def test_database_url_from_environment() -> str:
    try:
        from dotenv import load_dotenv
    except ImportError:
        pass
    else:
        load_dotenv()
    return validate_test_database_url(
        os.getenv("TEST_DATABASE_URL"),
        os.getenv("DATABASE_URL"),
    )
