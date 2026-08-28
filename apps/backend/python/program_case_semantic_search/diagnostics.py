from __future__ import annotations

import os
import shutil
import sys
from importlib import metadata as package_metadata
from pathlib import Path

from .config import (
    ALLOWED_WORKSPACE_CACHE,
    MODEL_DIMENSION,
    MODEL_ID,
    MODEL_REVISION,
)

PACKAGE_NAMES = (
    "sentence-transformers",
    "torch",
    "psycopg",
    "pgvector",
    "python-dotenv",
    "numpy",
)


def default_hugging_face_cache() -> Path:
    hub_cache = os.getenv("HUGGINGFACE_HUB_CACHE", "").strip()
    if hub_cache:
        return Path(hub_cache).expanduser().resolve()
    hf_home = os.getenv("HF_HOME", "").strip()
    root = Path(hf_home).expanduser() if hf_home else Path.home() / ".cache" / "huggingface"
    return (root / "hub").resolve()


def model_cache_directory(configured_cache: Path | None) -> Path:
    root = configured_cache or default_hugging_face_cache()
    return root / "models--nlpai-lab--KURE-v1"


def collect_model_diagnostics(configured_cache: Path | None) -> dict[str, object]:
    cache_root = configured_cache or default_hugging_face_cache()
    model_cache = model_cache_directory(configured_cache)
    disk_target = cache_root
    while not disk_target.exists() and disk_target.parent != disk_target:
        disk_target = disk_target.parent
    free_bytes = shutil.disk_usage(disk_target).free
    packages: dict[str, str] = {}
    for name in PACKAGE_NAMES:
        try:
            packages[name] = package_metadata.version(name)
        except package_metadata.PackageNotFoundError:
            packages[name] = "NOT_INSTALLED"
    return {
        "model": MODEL_ID,
        "modelRevision": MODEL_REVISION,
        "device": "cpu",
        "expectedEmbeddingDimension": MODEL_DIMENSION,
        "cacheDirectory": str(cache_root),
        "modelCacheDirectory": str(model_cache),
        "cacheExists": model_cache.exists(),
        "freeDiskBytes": free_bytes,
        "pythonExecutable": sys.executable,
        "pythonVersion": sys.version.split()[0],
        "packages": packages,
        "downloadStarted": False,
        "workspaceCacheAllowed": str(ALLOWED_WORKSPACE_CACHE),
    }
