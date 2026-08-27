from __future__ import annotations

import json
import os
import signal
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

from program_board_pgvector_search import (
    AUDIENCE_FILTERS,
    _provider,
    _settings,
    build_context_from_vector,
)


HOST = os.getenv("MOIRA_SEARCH_HOST", "127.0.0.1")
PORT = int(os.getenv("MOIRA_SEARCH_PORT", "8000"))
MAX_BODY_BYTES = 16 * 1024


class SearchRuntime:
    """KURE 모델 하나를 프로세스 수명 동안 재사용한다."""

    def __init__(self) -> None:
        self.provider = _provider(_settings())
        # 모델 생성자는 지연 로딩될 수 있으므로 실제 추론까지 마쳐 ready를 보장한다.
        self.provider.encode_query("도서관 프로그램")

    def context(self, query: str, limit: int, audience: str | None) -> dict[str, Any]:
        vector = self.provider.encode_query(query)
        return build_context_from_vector(query, vector, limit, audience)


RUNTIME: SearchRuntime | None = None


class SearchHandler(BaseHTTPRequestHandler):
    server_version = "MoiraSearch/1.0"

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path != "/health":
            self._json(404, {"error": "not found"})
            return
        self._json(200 if RUNTIME is not None else 503, {"ready": RUNTIME is not None})

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path != "/studio-context":
            self._json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._json(400, {"error": "invalid content length"})
            return
        if length <= 0 or length > MAX_BODY_BYTES:
            self._json(413, {"error": "request body is empty or too large"})
            return
        try:
            payload = json.loads(self.rfile.read(length))
            query = payload.get("query", "").strip()
            audience = payload.get("audience") or None
            limit = int(payload.get("limit", 5))
        except (AttributeError, TypeError, ValueError, json.JSONDecodeError):
            self._json(400, {"error": "invalid JSON request"})
            return
        if not query or len(query) > 1000:
            self._json(400, {"error": "query must contain 1-1000 characters"})
            return
        if audience is not None and audience not in AUDIENCE_FILTERS:
            self._json(400, {"error": "unsupported audience"})
            return
        if limit < 1 or limit > 5:
            self._json(400, {"error": "limit must be between 1 and 5"})
            return
        if RUNTIME is None:
            self._json(503, {"error": "search model is not ready"})
            return
        try:
            self._json(200, RUNTIME.context(query, limit, audience))
        except Exception as error:  # API boundary: log details, return a stable message.
            print(f"Studio context request failed: {error!r}", flush=True)
            self._json(500, {"error": "studio context search failed"})

    def log_message(self, message: str, *args: object) -> None:
        print(f"{self.address_string()} - {message % args}", flush=True)


def main() -> int:
    global RUNTIME
    print("Loading KURE search model...", flush=True)
    RUNTIME = SearchRuntime()
    server = HTTPServer((HOST, PORT), SearchHandler)

    def stop(_signum: int, _frame: object) -> None:
        # shutdown은 serve_forever와 다른 실행 흐름에서 호출되어야 하므로 신호에서는
        # 소켓만 닫고 SystemExit로 메인 루프를 끝낸다.
        server.server_close()
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    print(f"MOIRA search API ready on http://{HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
