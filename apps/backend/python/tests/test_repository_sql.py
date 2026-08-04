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
            '"embeddedContentHash"', '"contentHash"', '"targetAudience"',
        ):
            self.assertIn(name, source)
        self.assertIn("<=>", source)
        self.assertIn("POSITION(lower(%s::text)", source)

    def test_pilot_selector_is_valid_unembedded_and_bounded(self):
        source = inspect.getsource(embedding_repository.EmbeddingRepository.list_candidates)
        for guard in ('d."version" = \'2\'', 'c."builderVersion" = \'program-case-chunk-v2\'',
                      'btrim(c."content") <> \'\'', 'e."programCaseDocumentChunkId" IS NULL',
                      'LIMIT %s'):
            self.assertIn(guard, source)


if __name__ == "__main__":
    unittest.main()
