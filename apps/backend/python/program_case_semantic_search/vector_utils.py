from __future__ import annotations

import math
from collections.abc import Iterable

from .config import MODEL_DIMENSION
from .errors import VectorValidationError


def validate_vector(value: object, dimension: int = MODEL_DIMENSION) -> list[float]:
    if hasattr(value, "tolist"):
        value = value.tolist()
    if isinstance(value, (str, bytes)) or not isinstance(value, Iterable):
        raise VectorValidationError("embedding must be a numeric sequence")
    result: list[float] = []
    for item in value:
        if isinstance(item, bool) or not isinstance(item, (int, float)):
            raise VectorValidationError("embedding contains a non-numeric value")
        converted = float(item)
        if not math.isfinite(converted):
            raise VectorValidationError("embedding contains a non-finite value")
        result.append(converted)
    if len(result) != dimension:
        raise VectorValidationError(
            f"embedding dimension must be {dimension}, received {len(result)}"
        )
    return result


def make_test_vector(seed: int, dimension: int = MODEL_DIMENSION) -> list[float]:
    values = [float(((seed + index * 17) % 101) - 50) for index in range(dimension)]
    norm = math.sqrt(sum(value * value for value in values))
    return [value / norm for value in values]
