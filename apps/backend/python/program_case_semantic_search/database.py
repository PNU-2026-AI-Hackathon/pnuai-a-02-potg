from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from .errors import (
    DatabaseConnectionError,
    DatabaseOperationError,
    DatabasePrerequisiteError,
    DependencyError,
    SemanticSearchError,
)


def _load_psycopg():
    try:
        import psycopg
    except ImportError as exc:
        raise DependencyError(
            "psycopg is required; install apps/backend/python/requirements.txt"
        ) from exc
    return psycopg


@contextmanager
def connect(database_url: str, *, read_only: bool = False) -> Iterator[object]:
    psycopg = _load_psycopg()
    try:
        connection_context = psycopg.connect(database_url, autocommit=False)
    except Exception as exc:
        raise DatabaseConnectionError("PostgreSQL connection failed") from exc
    with connection_context as connection:
        if read_only:
            try:
                connection.execute("SET TRANSACTION READ ONLY")
            except Exception as exc:
                raise DatabaseOperationError("Could not start a read-only transaction") from exc
        try:
            from pgvector.psycopg import register_vector
        except ImportError as exc:
            raise DependencyError(
                "pgvector is required; install apps/backend/python/requirements.txt"
            ) from exc
        try:
            register_vector(connection)
        except Exception as exc:
            connection.rollback()
            raise DatabasePrerequisiteError(
                "pgvector is unavailable; apply the approved migration first"
            ) from exc
        try:
            yield connection
            if read_only:
                connection.rollback()
            else:
                connection.commit()
        except KeyboardInterrupt:
            connection.rollback()
            raise
        except SemanticSearchError:
            connection.rollback()
            raise
        except Exception as exc:
            try:
                connection.rollback()
            except Exception:
                pass
            raise DatabaseOperationError(
                "PostgreSQL operation failed",
                connection_lost=bool(getattr(connection, "closed", False)),
            ) from exc
