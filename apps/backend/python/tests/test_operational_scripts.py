import unittest
import inspect

from scripts import test_program_case_vector_integration
from scripts.select_representative_chunks import EXPECTED_TYPES, validate_representatives
from scripts.verify_program_case_embeddings import compare_snapshots


def representative(kind, chunk_id):
    return (kind, chunk_id, "CORE", 100, None, None, None, None)


class OperationalScriptTests(unittest.TestCase):
    def test_missing_representative_type_is_reported(self):
        rows = [
            representative(kind, f"chunk-{index}")
            for index, kind in enumerate(sorted(EXPECTED_TYPES - {"HWP"}))
        ]
        missing, duplicates = validate_representatives(rows)
        self.assertEqual(missing, ["HWP"])
        self.assertEqual(duplicates, [])

    def test_duplicate_representative_chunk_is_reported(self):
        rows = [
            representative(kind, "same" if index < 2 else f"chunk-{index}")
            for index, kind in enumerate(sorted(EXPECTED_TYPES))
        ]
        _, duplicates = validate_representatives(rows)
        self.assertEqual(duplicates, ["same"])

    def test_snapshot_difference_identifies_table(self):
        baseline = {
            table: {"count": 1, "sha256": "same"}
            for table in (
                "ProgramCase", "ProgramCaseSession", "ProgramCaseAttachment",
                "ProgramCaseDocument", "ProgramCaseDocumentChunk",
            )
        }
        current = {table: dict(value) for table, value in baseline.items()}
        current["ProgramCaseDocumentChunk"]["sha256"] = "changed"
        differences = compare_snapshots(baseline, current)
        self.assertEqual([item["table"] for item in differences], ["ProgramCaseDocumentChunk"])

    def test_integration_script_verifies_cascade_after_delete(self):
        source = inspect.getsource(test_program_case_vector_integration.main)
        self.assertIn("embedding cascade deletion failed", source)
        self.assertIn("if any(cursor.fetchone()):", source)


if __name__ == "__main__":
    unittest.main()
