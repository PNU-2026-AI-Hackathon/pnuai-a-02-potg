from __future__ import annotations

from collections.abc import Sequence

from .config import MODEL_DIMENSION, MODEL_ID, MODEL_REVISION, NORMALIZE_EMBEDDINGS
from .errors import DependencyError, ModelInferenceError, ModelLoadError
from .types import EmbeddingBatchResult
from .vector_utils import validate_vector


class KureEmbeddingProvider:
    def __init__(self, *, cache_folder: str | None = None) -> None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise DependencyError(
                "sentence-transformers and torch are required to load KURE-v1"
            ) from exc
        try:
            self._model = SentenceTransformer(
                MODEL_ID,
                revision=MODEL_REVISION,
                device="cpu",
                cache_folder=cache_folder,
                trust_remote_code=False,
            )
        except Exception as exc:
            raise ModelLoadError("KURE-v1 could not be loaded at the pinned revision") from exc
        self._max_sequence_length = int(self._model.max_seq_length)

    @property
    def dimension(self) -> int:
        return MODEL_DIMENSION

    def _input_lengths(self, texts: Sequence[str]) -> list[int]:
        try:
            tokenized = self._model.tokenizer(
                list(texts), add_special_tokens=True, truncation=False
            )
            lengths = [len(ids) for ids in tokenized["input_ids"]]
        except Exception as exc:
            raise ModelInferenceError("KURE-v1 input length validation failed") from exc
        if any(length > self._max_sequence_length for length in lengths):
            raise ModelInferenceError(
                f"KURE-v1 input exceeds the {self._max_sequence_length}-token limit"
            )
        return lengths

    def _encode(self, texts: Sequence[str]) -> EmbeddingBatchResult:
        lengths = self._input_lengths(texts)
        try:
            values = self._model.encode(
                list(texts),
                batch_size=len(texts),
                convert_to_numpy=True,
                normalize_embeddings=NORMALIZE_EMBEDDINGS,
                show_progress_bar=False,
            )
        except Exception as exc:
            raise ModelInferenceError("KURE-v1 inference failed") from exc
        return EmbeddingBatchResult(
            vectors=[validate_vector(value) for value in values],
            max_input_tokens=max(lengths, default=0),
        )

    def encode_documents(self, texts: Sequence[str]) -> EmbeddingBatchResult:
        if not texts:
            return EmbeddingBatchResult(vectors=[])
        return self._encode(texts)

    def encode_query(self, query: str) -> list[float]:
        return self._encode([query]).vectors[0]
