from __future__ import annotations

import argparse
import json
import sys
import traceback
from dataclasses import asdict
from typing import Sequence

from .config import (
    EMBEDDING_VERSION,
    MODEL_DIMENSION,
    MODEL_ID,
    MODEL_REVISION,
    PROVIDER,
    Settings,
    validate_batch_size,
)
from .database import connect
from .embedding_repository import EmbeddingRepository
from .embedding_service import EmbeddingService
from .errors import CliInputError, SemanticSearchError
from .kure_embedding_provider import KureEmbeddingProvider
from .search_repository import CHUNK_TYPES, SearchRepository
from .search_service import SearchService
from .selectors import EmbeddingSelector, SelectorKind, parse_chunk_id
from .types import EmbeddingMetadata


def metadata() -> EmbeddingMetadata:
    return EmbeddingMetadata(
        provider=PROVIDER, model=MODEL_ID, model_revision=MODEL_REVISION,
        embedding_version=EMBEDDING_VERSION, dimension=MODEL_DIMENSION,
    )


class SafeArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise CliInputError(message)


def build_parser() -> argparse.ArgumentParser:
    parser = SafeArgumentParser(prog="program-case-semantic-search")
    subcommands = parser.add_subparsers(dest="command", required=True)
    embed = subcommands.add_parser("embed")
    selectors = embed.add_mutually_exclusive_group(required=True)
    selectors.add_argument("--chunk-id", type=parse_chunk_id)
    selectors.add_argument("--all", action="store_true")
    selectors.add_argument("--failed", action="store_true")
    selectors.add_argument("--stale", action="store_true")
    embed.add_argument("--batch-size", type=validate_batch_size)
    embed.add_argument("--dry-run", action="store_true")
    embed.add_argument("--json", action="store_true")
    embed.add_argument("--debug", action="store_true")

    search = subcommands.add_parser("search")
    search.add_argument("--query", required=True)
    search.add_argument("--limit", type=int, default=5)
    search.add_argument("--chunk-type", choices=sorted(CHUNK_TYPES))
    search.add_argument("--json", action="store_true")
    search.add_argument("--debug", action="store_true")
    return parser


def selector_from_args(args: argparse.Namespace) -> EmbeddingSelector:
    if args.chunk_id:
        return EmbeddingSelector(SelectorKind.CHUNK_ID, args.chunk_id)
    if args.all:
        return EmbeddingSelector(SelectorKind.ALL)
    if args.failed:
        return EmbeddingSelector(SelectorKind.FAILED)
    return EmbeddingSelector(SelectorKind.STALE)


def _provider(settings: Settings) -> KureEmbeddingProvider:
    return KureEmbeddingProvider(
        cache_folder=str(settings.model_cache_dir) if settings.model_cache_dir else None
    )


def _print_error(error: Exception, *, json_output: bool, debug: bool) -> None:
    code = error.code if isinstance(error, SemanticSearchError) else "UNEXPECTED_ERROR"
    if isinstance(error, CliInputError):
        message = str(error)
    elif isinstance(error, SemanticSearchError):
        message = str(error)
    else:
        message = "Unexpected semantic search failure"
    if json_output:
        print(json.dumps({
            "ok": False, "failureCode": code, "message": message
        }, ensure_ascii=False))
    else:
        print(f"error [{code}]: {message}", file=sys.stderr)
    if debug:
        traceback.print_exc(file=sys.stderr)


def _print_search(response, *, json_output: bool) -> None:
    if json_output:
        print(json.dumps({
            "model": MODEL_ID, "modelRevision": MODEL_REVISION,
            "dimension": MODEL_DIMENSION, "elapsedSeconds": response.elapsed_seconds,
            "results": [asdict(result) for result in response.results],
        }, ensure_ascii=False, indent=2))
        return
    print(f"Model: {MODEL_ID}")
    print(f"Model revision: {MODEL_REVISION}")
    print(f"Dimension: {MODEL_DIMENSION}")
    print(f"Elapsed time: {response.elapsed_seconds:.3f}s")
    print("Results:")
    for result in response.results:
        preview = " ".join(result.content.split())[:300]
        print(
            f"{result.rank}. {result.similarity:.6f} | {result.program_title} | "
            f"{result.target} | {result.chunk_type} | {result.chunk_key} | "
            f"{result.source_label or '-'}\n   {preview}"
        )


def _summary_payload(summary) -> dict[str, object]:
    return {
        "chunksProcessed": summary.chunks_processed,
        "chunksSucceeded": summary.chunks_succeeded,
        "chunksFailed": summary.chunks_failed,
        "embeddingsCreated": summary.embeddings_created,
        "embeddingsUpdated": summary.embeddings_updated,
        "embeddingsUnchanged": summary.embeddings_unchanged,
        "embeddingsSkipped": summary.embeddings_skipped,
        "batchesProcessed": summary.batches_processed,
        "modelEncodeCalls": summary.model_encode_calls,
        "totalCandidates": summary.total_candidates,
        "wouldCreate": summary.would_create,
        "wouldUpdate": summary.would_update,
        "skippedRecentProcessing": summary.skipped_recent_processing,
        "skippedEmpty": summary.skipped_empty,
        "maxInputTokens": summary.max_input_tokens,
        "elapsedSeconds": summary.elapsed_seconds,
        "failures": summary.failures,
    }


def _print_summary(summary, *, json_output: bool) -> None:
    payload = _summary_payload(summary)
    if json_output:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return
    for key, value in payload.items():
        if key != "failures":
            print(f"{key}: {value}")
    if payload["failures"]:
        print(f"failures: {len(payload['failures'])}")


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args: argparse.Namespace | None = None
    effective_argv = list(argv) if argv is not None else sys.argv[1:]
    try:
        args = parser.parse_args(effective_argv)
        try:
            from dotenv import load_dotenv
        except ImportError:
            pass
        else:
            load_dotenv()
        settings = Settings.from_environment()
        if args.command == "embed":
            batch_size = args.batch_size or settings.batch_size
            with connect(settings.database_url) as connection:
                repository = EmbeddingRepository(connection)
                def provider_factory():
                    if args.dry_run:  # pragma: no cover - guarded by the service
                        raise AssertionError("dry-run must not create a provider")
                    return _provider(settings)
                summary = EmbeddingService(
                    repository, provider_factory, metadata(), batch_size=batch_size
                ).run(selector_from_args(args), dry_run=args.dry_run)
            _print_summary(summary, json_output=args.json)
            return 1 if summary.chunks_failed else 0

        provider = _provider(settings)
        with connect(settings.database_url, read_only=True) as connection:
            response = SearchService(
                SearchRepository(connection), provider, metadata()
            ).search(args.query, limit=args.limit, chunk_type=args.chunk_type)
        _print_search(response, json_output=args.json)
        return 0
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        return 130
    except CliInputError as error:
        _print_error(
            error,
            json_output=bool(
                getattr(args, "json", False) or "--json" in effective_argv
            ),
            debug=bool(getattr(args, "debug", False)),
        )
        return 2
    except ValueError as error:
        wrapped = CliInputError(str(error))
        _print_error(
            wrapped, json_output=bool(getattr(args, "json", False)),
            debug=bool(getattr(args, "debug", False)),
        )
        return 2
    except SemanticSearchError as error:
        _print_error(
            error, json_output=bool(getattr(args, "json", False)),
            debug=bool(getattr(args, "debug", False)),
        )
        return 1
    except Exception as error:
        _print_error(
            error, json_output=bool(getattr(args, "json", False)),
            debug=bool(getattr(args, "debug", False)),
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
