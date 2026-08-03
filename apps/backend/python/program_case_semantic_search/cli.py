from __future__ import annotations

import argparse
import json
import sys
import traceback
from typing import Sequence
from urllib.parse import urlsplit

from .config import (
    EMBEDDING_VERSION,
    MODEL_DIMENSION,
    MODEL_ID,
    MODEL_REVISION,
    PROVIDER,
    Settings,
    validate_batch_size,
)
from .database import connect, inspect_current_database
from .diagnostics import collect_model_diagnostics
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
    selectors.add_argument(
        "--pilot-size", type=lambda value: validate_batch_size(int(value))
    )
    selectors.add_argument("--all", action="store_true")
    selectors.add_argument("--failed", action="store_true")
    selectors.add_argument("--stale", action="store_true")
    embed.add_argument(
        "--batch-size", type=lambda value: validate_batch_size(int(value))
    )
    embed.add_argument("--dry-run", action="store_true")
    embed.add_argument("--confirm-database")
    embed.add_argument("--json", action="store_true")
    embed.add_argument("--debug", action="store_true")

    search = subcommands.add_parser("search")
    search.add_argument("--query", required=True)
    search.add_argument("--limit", type=int, default=5)
    search.add_argument("--threshold", type=float)
    search.add_argument("--chunk-type", choices=sorted(CHUNK_TYPES))
    search.add_argument("--json", action="store_true")
    search.add_argument("--debug", action="store_true")
    diagnose = subcommands.add_parser("diagnose")
    diagnose.add_argument("--json", action="store_true")
    diagnose.add_argument("--debug", action="store_true")
    return parser


def selector_from_args(args: argparse.Namespace) -> EmbeddingSelector:
    if args.chunk_id:
        return EmbeddingSelector(SelectorKind.CHUNK_ID, args.chunk_id)
    if args.pilot_size:
        return EmbeddingSelector(SelectorKind.PILOT, limit=args.pilot_size)
    if args.all:
        return EmbeddingSelector(SelectorKind.ALL)
    if args.failed:
        return EmbeddingSelector(SelectorKind.FAILED)
    return EmbeddingSelector(SelectorKind.STALE)


def validate_write_confirmation(
    database_name: str, confirmed_database: str | None, *, dry_run: bool
) -> None:
    if not dry_run and confirmed_database != database_name:
        raise CliInputError(
            "write blocked: --confirm-database must exactly match "
            f"the current database name ({database_name})"
        )


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


def _print_search(
    response, *, json_output: bool, limit: int, threshold: float | None
) -> None:
    if json_output:
        safe_results = [
            {
                "rank": result.rank,
                "programTitle": result.program_title,
                "similarity": result.similarity,
                "chunkType": result.chunk_type,
                "sourceLabel": result.source_label,
                "programCaseId": result.program_case_id,
                "programCaseDocumentId": result.program_case_document_id,
                "chunkId": result.chunk_id,
            }
            for result in response.results
        ]
        print(json.dumps({
            "model": MODEL_ID, "modelRevision": MODEL_REVISION,
            "embeddingVersion": EMBEDDING_VERSION,
            "dimension": MODEL_DIMENSION, "elapsedSeconds": response.elapsed_seconds,
            "limit": limit, "threshold": threshold,
            "results": safe_results,
        }, ensure_ascii=False, indent=2))
        return
    print(f"Model: {MODEL_ID}")
    print(f"Model revision: {MODEL_REVISION}")
    print(f"Embedding version: {EMBEDDING_VERSION}")
    print(f"Dimension: {MODEL_DIMENSION}")
    print(f"Limit: {limit}")
    if threshold is not None:
        print(f"Threshold: {threshold}")
    print(f"Elapsed time: {response.elapsed_seconds:.3f}s")
    print("Results:")
    for result in response.results:
        print(
            f"{result.rank}. {result.program_title} | similarity={result.similarity:.6f} | "
            f"chunk_type={result.chunk_type} | source={result.source_label or '-'} | "
            f"program_case_id={result.program_case_id} | chunk_id={result.chunk_id}"
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
    aggregate = {
        "TOTAL": summary.total_candidates,
        "CREATED": summary.embeddings_created,
        "UPDATED": summary.embeddings_updated,
        "UNCHANGED": summary.embeddings_unchanged,
        "FAILED": summary.chunks_failed,
        "SKIPPED": summary.embeddings_skipped,
    }
    for key, value in aggregate.items():
        print(f"{key}: {value}")
    print(f"BATCHES: {summary.batches_processed}")
    print(f"MODEL_ENCODE_CALLS: {summary.model_encode_calls}")
    print(f"ELAPSED_SECONDS: {summary.elapsed_seconds:.3f}")
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
        settings = Settings.from_environment(require_database=args.command != "diagnose")
        if args.command == "diagnose":
            payload = collect_model_diagnostics(settings.model_cache_dir)
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            return 0
        if args.command == "embed":
            batch_size = args.batch_size or settings.batch_size
            database_name = inspect_current_database(settings.database_url)
            database_host = urlsplit(settings.database_url).hostname or "unknown"
            identity_stream = sys.stderr if args.json else sys.stdout
            print(f"Database: {database_name}", file=identity_stream)
            print(f"Database host: {database_host}", file=identity_stream)
            print(
                f"Write operation: {'no (dry-run)' if args.dry_run else 'yes'}",
                file=identity_stream,
            )
            validate_write_confirmation(
                database_name, args.confirm_database, dry_run=args.dry_run
            )
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
            ).search(
                args.query, limit=args.limit, threshold=args.threshold,
                chunk_type=args.chunk_type
            )
        _print_search(
            response, json_output=args.json, limit=args.limit,
            threshold=args.threshold
        )
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
