import unittest
import io
import inspect
import json
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch

from program_case_semantic_search.cli import (
    build_parser,
    main,
    selector_from_args,
    validate_write_confirmation,
)
from program_case_semantic_search.errors import CliInputError, DatabaseConnectionError
from program_case_semantic_search.selectors import SelectorKind
from program_case_semantic_search.search_service import SearchResponse
from program_case_semantic_search.types import SearchResult


class CliTests(unittest.TestCase):
    def test_search_output_has_no_content_preview(self):
        import program_case_semantic_search.cli as cli_module
        source = inspect.getsource(cli_module)
        self.assertNotIn('preview =', source)
        self.assertNotIn('result.content.split()', source)

    def test_json_search_output_excludes_content_and_target(self):
        from program_case_semantic_search.cli import _print_search

        result = SearchResult(
            rank=1,
            similarity=0.8,
            program_case_id="program",
            program_case_document_id="document",
            chunk_id="chunk",
            chunk_key="core",
            chunk_type="CORE",
            chunk_order=0,
            source_label="기본 정보",
            program_title="안전한 프로그램명",
            target="출력하면 안 되는 대상 원문",
            content="출력하면 안 되는 청크 원문",
        )
        stdout = io.StringIO()
        with redirect_stdout(stdout):
            _print_search(
                SearchResponse([result], 0.1),
                json_output=True,
                limit=5,
                threshold=None,
            )
        payload = json.loads(stdout.getvalue())
        serialized = json.dumps(payload, ensure_ascii=False)
        self.assertNotIn("청크 원문", serialized)
        self.assertNotIn("대상 원문", serialized)
        self.assertEqual(payload["results"][0]["programTitle"], "안전한 프로그램명")

    def test_selectors(self):
        parser = build_parser()
        for option, kind in (
            ("--all", SelectorKind.ALL), ("--failed", SelectorKind.FAILED),
            ("--stale", SelectorKind.STALE), ("--pilot-size=8", SelectorKind.PILOT),
        ):
            args = parser.parse_args(["embed", option, "--dry-run"])
            self.assertEqual(selector_from_args(args).kind, kind)

    def test_pilot_selector_preserves_limit(self):
        args = build_parser().parse_args(["embed", "--pilot-size", "8", "--dry-run"])
        selector = selector_from_args(args)
        self.assertEqual(selector.kind, SelectorKind.PILOT)
        self.assertEqual(selector.limit, 8)

    def test_embed_batch_size_parses_as_integer(self):
        args = build_parser().parse_args(["embed", "--all", "--batch-size", "8"])
        self.assertEqual(args.batch_size, 8)

    def test_duplicate_selector_and_invalid_limit_fail(self):
        parser = build_parser()
        with self.assertRaises(CliInputError):
            parser.parse_args(["embed", "--all", "--failed"])
        args = parser.parse_args(["search", "--query", "검색", "--limit", "21"])
        self.assertEqual(args.limit, 21)  # service owns semantic range validation

    def test_json_error_stdout_is_valid_json_and_stderr_is_empty(self):
        stdout = io.StringIO()
        stderr = io.StringIO()
        with patch(
            "program_case_semantic_search.cli.Settings.from_environment",
            side_effect=DatabaseConnectionError("PostgreSQL connection failed"),
        ), redirect_stdout(stdout), redirect_stderr(stderr):
            code = main(["embed", "--all", "--json"])
        self.assertEqual(code, 1)
        self.assertIn('"failureCode": "DATABASE_CONNECTION_ERROR"', stdout.getvalue())
        self.assertEqual(stderr.getvalue(), "")

    def test_write_requires_exact_database_confirmation(self):
        with self.assertRaises(CliInputError):
            validate_write_confirmation("moira", None, dry_run=False)
        with self.assertRaises(CliInputError):
            validate_write_confirmation("moira", "other", dry_run=False)
        validate_write_confirmation("moira", "moira", dry_run=False)
        validate_write_confirmation("moira", None, dry_run=True)

    def test_parser_supports_threshold_and_confirmation(self):
        parser = build_parser()
        embed = parser.parse_args([
            "embed", "--all", "--confirm-database", "moira"
        ])
        self.assertEqual(embed.confirm_database, "moira")
        search = parser.parse_args([
            "search", "--query", "query", "--threshold", "0.4"
        ])
        self.assertEqual(search.threshold, 0.4)

    def test_keyboard_interrupt_returns_130(self):
        stderr = io.StringIO()
        with patch(
            "program_case_semantic_search.cli.Settings.from_environment",
            side_effect=KeyboardInterrupt,
        ), redirect_stderr(stderr):
            code = main(["embed", "--all"])
        self.assertEqual(code, 130)
        self.assertIn("Interrupted", stderr.getvalue())

    def test_unexpected_error_is_sanitized(self):
        stdout = io.StringIO()
        stderr = io.StringIO()
        with patch(
            "program_case_semantic_search.cli.Settings.from_environment",
            side_effect=RuntimeError("postgresql://user:password@private-host/database"),
        ), redirect_stdout(stdout), redirect_stderr(stderr):
            code = main(["embed", "--all"])
        self.assertEqual(code, 1)
        self.assertNotIn("private-host", stderr.getvalue())
        self.assertNotIn("password", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
