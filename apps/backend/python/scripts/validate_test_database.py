from __future__ import annotations

import json

from program_case_semantic_search.errors import ConfigurationError
from program_case_semantic_search.test_database import test_database_url_from_environment


def main() -> int:
    try:
        test_database_url_from_environment()
    except ConfigurationError as error:
        print(json.dumps({
            "testDatabaseConfigured": False,
            "safeToConnect": False,
            "failureCode": error.code,
            "message": str(error),
        }, ensure_ascii=False))
        return 2
    print(json.dumps({
        "testDatabaseConfigured": True,
        "safeToConnect": True,
        "productionUrlDifferent": True,
        "testDatabaseMarkerPresent": True,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
