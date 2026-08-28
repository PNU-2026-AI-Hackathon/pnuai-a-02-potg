import unittest

from program_case_semantic_search.embedding_repository import EmbeddingRepository
from program_case_semantic_search.errors import DatabaseOperationError
from program_case_semantic_search.types import ChunkCandidate, EmbeddingMetadata
from program_case_semantic_search.vector_utils import make_test_vector


class FailingCursor:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self

    rowcount = 1

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, statement, params=()):
        self.connection.execute_count += 1
        if self.connection.execute_count == 4:
            raise RuntimeError("fourth write failed")


class FailingConnection:
    closed = False

    def __init__(self):
        self.execute_count = 0
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return FailingCursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


class RepositoryTransactionTests(unittest.TestCase):
    def test_fourth_write_rolls_back_entire_batch(self):
        connection = FailingConnection()
        repository = EmbeddingRepository(connection)
        chunks = [
            ChunkCandidate(str(index), "content", f"hash-{index}")
            for index in range(8)
        ]
        metadata = EmbeddingMetadata("provider", "model", "revision", "version", 1024)
        with self.assertRaises(DatabaseOperationError):
            repository.save_batch_success(
                chunks, [make_test_vector(index) for index in range(8)], metadata
            )
        self.assertEqual(connection.execute_count, 4)
        self.assertEqual(connection.commits, 0)
        self.assertEqual(connection.rollbacks, 1)


if __name__ == "__main__":
    unittest.main()
