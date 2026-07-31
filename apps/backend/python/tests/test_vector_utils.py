import math
import unittest

from program_case_semantic_search.errors import VectorValidationError
from program_case_semantic_search.vector_utils import make_test_vector, validate_vector


class ArrayLike:
    def tolist(self):
        return make_test_vector(3)


class VectorTests(unittest.TestCase):
    def test_valid_and_array_like(self):
        self.assertEqual(len(validate_vector(make_test_vector(1))), 1024)
        self.assertEqual(len(validate_vector(ArrayLike())), 1024)
        self.assertAlmostEqual(sum(v * v for v in make_test_vector(2)), 1.0)

    def test_rejects_invalid_vectors(self):
        cases = ([0.0], [0.0] * 1023 + [math.nan],
                 [0.0] * 1023 + [math.inf], [0.0] * 1023 + ["x"])
        for value in cases:
            with self.subTest(value=value[-1]):
                with self.assertRaises(VectorValidationError):
                    validate_vector(value)


if __name__ == "__main__":
    unittest.main()
