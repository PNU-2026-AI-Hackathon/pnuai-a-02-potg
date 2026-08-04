from __future__ import annotations

import unittest

from program_case_search_profile.pilot import select_pilot
from program_case_search_profile.profiles import build_profile
from program_case_search_profile.repository import ProgramSource


class SearchProfilePilotTest(unittest.TestCase):
    def source(self, index: int, title: str = "초등학생 환경 실험") -> ProgramSource:
        return ProgramSource(str(index).zfill(36), title, "초등학생", "", "", (), ())

    def test_profile_is_deterministic_and_public_safe(self):
        source = self.source(1, "환경 실험 010-1234-5678 test@example.com")
        first = build_profile(source)
        second = build_profile(source)
        self.assertEqual(first, second)
        self.assertNotIn("010-1234-5678", first["representativeDocument"])
        self.assertNotIn("test@example.com", first["representativeDocument"])
        self.assertTrue(first["validation"]["valid"])

    def test_selection_returns_unique_deterministic_thirty(self):
        profiles = [build_profile(self.source(index, f"프로그램 {index} 환경 실험")) for index in range(35)]
        first = select_pilot(profiles)
        second = select_pilot(profiles)
        self.assertEqual(first, second)
        self.assertEqual(len(first), 30)
        self.assertEqual(len({item["programCaseId"] for item in first}), 30)


if __name__ == "__main__":
    unittest.main()
