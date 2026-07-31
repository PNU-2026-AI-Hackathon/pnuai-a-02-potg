from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from uuid import UUID


class SelectorKind(str, Enum):
    CHUNK_ID = "chunk_id"
    ALL = "all"
    FAILED = "failed"
    STALE = "stale"


@dataclass(frozen=True)
class EmbeddingSelector:
    kind: SelectorKind
    chunk_id: str | None = None


def parse_chunk_id(value: str) -> str:
    return str(UUID(value))
