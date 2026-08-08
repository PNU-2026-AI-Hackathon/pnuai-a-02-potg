import tempfile
import unittest
from pathlib import Path

from program_case_semantic_search.diagnostics import collect_model_diagnostics


class DiagnosticsTests(unittest.TestCase):
    def test_diagnostics_does_not_create_or_download_model_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory) / "cache"
            result = collect_model_diagnostics(cache)
            self.assertFalse(cache.exists())
            self.assertFalse(result["cacheExists"])
            self.assertFalse(result["downloadStarted"])
            self.assertEqual(result["expectedEmbeddingDimension"], 1024)
            self.assertEqual(result["device"], "cpu")


if __name__ == "__main__":
    unittest.main()
