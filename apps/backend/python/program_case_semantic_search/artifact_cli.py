from __future__ import annotations
import argparse, hashlib, json, math, os, sys
from datetime import datetime, timezone
from .config import MODEL_ID, MODEL_REVISION, MODEL_DIMENSION, NORMALIZE_EMBEDDINGS
from .kure_embedding_provider import KureEmbeddingProvider

PROVIDER_VERSION = "kure-artifact-provider-v1"
def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--input", required=True); parser.add_argument("--output", required=True); parser.add_argument("--corpus-type", required=True); parser.add_argument("--query")
    args = parser.parse_args(); provider = KureEmbeddingProvider(cache_folder=os.getenv("KURE_MODEL_CACHE_DIR") or None)
    if args.query:
        print(json.dumps({"embedding": provider.encode_query(args.query)}, ensure_ascii=False)); return 0
    rows = [json.loads(line) for line in open(args.input, encoding="utf-8") if line.strip()]
    existing = {}
    try:
        existing = {r["corpusId"]: r for r in json.load(open(args.output, encoding="utf-8"))}
    except (FileNotFoundError, json.JSONDecodeError): pass
    output=[]
    for offset in range(0, len(rows), 8):
        batch=rows[offset:offset+8]; reusable=[]; pending=[]
        for row in batch:
            old=existing.get(row["corpusId"])
            if old and old.get("contentHash")==row["contentHash"] and old.get("model")==MODEL_ID and old.get("modelRevision")==MODEL_REVISION and old.get("providerVersion")==PROVIDER_VERSION and old.get("normalized")==NORMALIZE_EMBEDDINGS: reusable.append(old)
            else: pending.append(row)
        output.extend(reusable)
        if pending:
            vectors=provider.encode_documents([r["denseText"] for r in pending]).vectors
            for row, vector in zip(pending, vectors):
                packed=json.dumps(vector,separators=(",",":"))
                output.append({"corpusId":row["corpusId"],"groupId":row["groupId"],"corpusType":args.corpus_type,"contentHash":row["contentHash"],"model":MODEL_ID,"modelRevision":MODEL_REVISION,"providerVersion":PROVIDER_VERSION,"dimension":MODEL_DIMENSION,"normalized":NORMALIZE_EMBEDDINGS,"embedding":vector,"embeddingHash":hashlib.sha256(packed.encode()).hexdigest(),"status":"COMPLETED","error":None,"generatedAt":None})
        print(f"embedded {min(offset+8,len(rows))}/{len(rows)}", file=sys.stderr)
    output.sort(key=lambda r:r["corpusId"])
    with open(args.output,"w",encoding="utf-8") as handle: json.dump(output,handle,ensure_ascii=False,separators=(",",":"))
    return 0
if __name__ == "__main__": raise SystemExit(main())
