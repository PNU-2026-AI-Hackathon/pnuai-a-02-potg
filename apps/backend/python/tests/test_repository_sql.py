import inspect
import unittest

from program_case_semantic_search import embedding_repository, search_repository


class RepositorySqlTests(unittest.TestCase):
    def test_sql_uses_bound_parameters_and_no_user_fstrings(self):
        for module in (embedding_repository, search_repository):
            source = inspect.getsource(module)
            self.assertIn("%s", source)
            self.assertNotIn("f'''", source)
            self.assertNotIn('f"""', source)
            self.assertNotIn("queryRawUnsafe", source)

    def test_search_has_required_stale_guards(self):
        source = inspect.getsource(search_repository.SearchRepository.search)
        for name in (
            '"status"', '"provider"', '"modelRevision"', '"embeddingVersion"',
            '"embeddedContentHash"', '"contentHash"',
        ):
            self.assertIn(name, source)
        self.assertIn("<=>", source)


if __name__ == "__main__":
    unittest.main()
