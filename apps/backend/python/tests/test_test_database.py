import unittest

from program_case_semantic_search.errors import ConfigurationError
from program_case_semantic_search.test_database import validate_test_database_url


class TestDatabaseGuardTests(unittest.TestCase):
    def test_accepts_explicitly_named_separate_test_database(self):
        result = validate_test_database_url(
            "postgresql://test_user:secret@test-host/moira_integration?sslmode=require",
            "postgresql://prod_user:secret@prod-host/moira?sslmode=require",
        )
        self.assertIn("/moira_integration", result)

    def test_rejects_missing_test_url(self):
        with self.assertRaises(ConfigurationError):
            validate_test_database_url(None, "postgresql://user:pass@host/moira")

    def test_rejects_identical_url(self):
        url = "postgresql://user:pass@host/moira_test"
        with self.assertRaises(ConfigurationError):
            validate_test_database_url(url, url)

    def test_rejects_same_database_name_even_on_different_host(self):
        with self.assertRaises(ConfigurationError):
            validate_test_database_url(
                "postgresql://user:pass@test-host/moira_test",
                "postgresql://user:pass@prod-host/moira_test",
            )

    def test_rejects_database_without_test_marker(self):
        with self.assertRaises(ConfigurationError):
            validate_test_database_url(
                "postgresql://user:pass@test-host/moira",
                "postgresql://user:pass@prod-host/production",
            )

    def test_rejects_unparseable_database_name(self):
        with self.assertRaises(ConfigurationError):
            validate_test_database_url(
                "postgresql://user:pass@test-host/",
                "postgresql://user:pass@prod-host/moira",
            )


if __name__ == "__main__":
    unittest.main()
