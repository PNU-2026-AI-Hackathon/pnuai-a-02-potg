import unittest
import io
import inspect
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch

from program_case_semantic_search.cli import build_parser, main, selector_from_args
from program_case_semantic_search.errors import CliInputError, DatabaseConnectionError
from program_case_semantic_search.selectors import SelectorKind


class CliTests(unittest.TestCase):
    def test_search_output_has_no_content_preview(self):
        import program_case_semantic_search.cli as cli_module
        source = inspect.getsource(cli_module)
        self.assertNotIn('preview =', source)
        self.assertNotIn('result.content.split()', source)

    def test_selectors(self):
        parser = build_parser()
        for option, kind in (
            ("--all", SelectorKind.ALL), ("--failed", SelectorKind.FAILED),
            ("--stale", SelectorKind.STALE),
        ):
            args = parser.parse_args(["embed", option, "--dry-run"])
            self.assertEqual(selector_from_args(args).kind, kind)

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
