import unittest

from program_case_semantic_search.database import inspect_current_database


class FakeResult:
    def fetchone(self):
        return ("moira",)


class FakeConnection:
    def __init__(self):
        self.statements = []
        self.rolled_back = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, statement):
        self.statements.append(statement)
        return FakeResult()

    def rollback(self):
        self.rolled_back = True


class FakePsycopg:
    def __init__(self):
        self.connection = FakeConnection()

    def connect(self, database_url, autocommit):
        self.database_url = database_url
        self.autocommit = autocommit
        return self.connection


class DatabaseIdentityTests(unittest.TestCase):
    def test_identity_check_is_read_only_and_does_not_register_vector(self):
        fake = FakePsycopg()
        import program_case_semantic_search.database as database

        original = database._load_psycopg
        database._load_psycopg = lambda: fake
        try:
            self.assertEqual(
                inspect_current_database("postgresql://example/moira"), "moira"
            )
        finally:
            database._load_psycopg = original
        self.assertEqual(
            fake.connection.statements,
            ["SET TRANSACTION READ ONLY", "SELECT current_database()"],
        )
        self.assertTrue(fake.connection.rolled_back)


if __name__ == "__main__":
    unittest.main()
