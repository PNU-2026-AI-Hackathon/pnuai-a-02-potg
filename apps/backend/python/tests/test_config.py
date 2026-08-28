import os
import unittest
from unittest.mock import patch

from program_case_semantic_search.config import (
    ALLOWED_WORKSPACE_CACHE, EMBEDDING_VERSION, MODEL_DIMENSION, MODEL_REVISION,
    Settings, sanitize_database_url, validate_batch_size, validate_model_cache_dir,
)
from program_case_semantic_search.errors import ConfigurationError


class ConfigTests(unittest.TestCase):
    def test_metadata_is_pinned(self):
        self.assertEqual(MODEL_DIMENSION, 1024)
        self.assertEqual(len(MODEL_REVISION), 40)
        self.assertIn(MODEL_REVISION[:12], EMBEDDING_VERSION)

    def test_database_is_required(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ConfigurationError):
                Settings.from_environment()

    def test_batch_bounds(self):
        self.assertEqual(validate_batch_size(8), 8)
        for value in (0, 33):
            with self.assertRaises(ConfigurationError):
                validate_batch_size(value)

    def test_prisma_only_query_options_are_removed(self):
        url = sanitize_database_url(
            "postgresql://user:pass@db.example/test?schema=public&sslmode=require"
        )
        self.assertNotIn("schema=", url)
        self.assertIn("sslmode=require", url)
        self.assertNotIn("pass@", repr(Settings(url)))

    def test_only_fixed_workspace_cache_is_allowed(self):
        self.assertEqual(
            validate_model_cache_dir(str(ALLOWED_WORKSPACE_CACHE)),
            ALLOWED_WORKSPACE_CACHE,
        )
        with self.assertRaises(ConfigurationError):
            validate_model_cache_dir(str(ALLOWED_WORKSPACE_CACHE.parent / "models"))


if __name__ == "__main__":
    unittest.main()
