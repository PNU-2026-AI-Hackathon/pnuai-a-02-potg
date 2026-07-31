import unittest

from program_case_semantic_search.errors import ModelInferenceError
from program_case_semantic_search.kure_embedding_provider import KureEmbeddingProvider


class FakeTokenizer:
    def __init__(self, lengths):
        self.lengths = lengths

    def __call__(self, texts, **options):
        return {"input_ids": [[0] * length for length in self.lengths]}


class FakeModel:
    max_seq_length = 8

    def __init__(self, lengths):
        self.tokenizer = FakeTokenizer(lengths)


class KureProviderTests(unittest.TestCase):
    def provider(self, lengths):
        provider = KureEmbeddingProvider.__new__(KureEmbeddingProvider)
        provider._model = FakeModel(lengths)
        provider._max_sequence_length = 8
        return provider

    def test_input_length_is_observed(self):
        self.assertEqual(self.provider([3, 7])._input_lengths(["a", "b"]), [3, 7])

    def test_over_limit_input_is_rejected_before_encode(self):
        with self.assertRaises(ModelInferenceError):
            self.provider([9])._input_lengths(["too long"])


if __name__ == "__main__":
    unittest.main()
