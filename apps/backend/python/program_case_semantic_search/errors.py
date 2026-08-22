class SemanticSearchError(Exception):
    """Base error with a stable, non-sensitive code."""

    code = "SEMANTIC_SEARCH_ERROR"


class ConfigurationError(SemanticSearchError):
    code = "CONFIGURATION_ERROR"


class DependencyError(SemanticSearchError):
    code = "DEPENDENCY_ERROR"


class ModelError(SemanticSearchError):
    code = "MODEL_ERROR"


class VectorValidationError(SemanticSearchError):
    code = "VECTOR_VALIDATION_ERROR"


class DatabasePrerequisiteError(SemanticSearchError):
    code = "DATABASE_PREREQUISITE_ERROR"


class DatabaseConnectionError(SemanticSearchError):
    code = "DATABASE_CONNECTION_ERROR"


class DatabaseOperationError(SemanticSearchError):
    code = "DATABASE_OPERATION_ERROR"

    def __init__(self, message: str, *, connection_lost: bool = False) -> None:
        super().__init__(message)
        self.connection_lost = connection_lost


class ModelLoadError(ModelError):
    code = "MODEL_LOAD_ERROR"


class ModelInferenceError(ModelError):
    code = "MODEL_INFERENCE_ERROR"


class ChunkNotFoundError(SemanticSearchError):
    code = "CHUNK_NOT_FOUND"


class CliInputError(SemanticSearchError):
    code = "INVALID_ARGUMENT"
