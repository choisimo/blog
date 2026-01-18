#!/usr/bin/env python3
"""
RAG Indexing via Backend API (Simple Version)

This script reads the posts-manifest.json and indexes blog posts
into ChromaDB using the Backend's /api/v1/rag/index endpoint.

Usage:
    python scripts/rag/index_via_api.py
"""

import os
import json
import sys
import re
from pathlib import Path
from typing import Any, Dict, List
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# Configuration
BACKEND_URL = os.environ.get("BACKEND_URL", "https://blog-b.nodove.com").rstrip("/")
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "20"))  # TEI max is 32, use 20 for safety
MAX_CONTENT_CHARS = int(os.environ.get("MAX_CONTENT_CHARS", "800"))  # ~200 tokens
INDEX_ENDPOINT = f"{BACKEND_URL}/api/v1/rag/index"

# Path configuration
REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = REPO_ROOT / "frontend/public/posts-manifest.json"
PUBLIC_DIR = REPO_ROOT / "frontend/public"


def strip_markdown(text: str) -> str:
    """Simple markdown to plain text conversion."""
    # Remove frontmatter
    text = re.sub(r"^---\n.*?\n---\n", "", text, flags=re.DOTALL)
    # Remove code blocks
    text = re.sub(r"```.*?```", "", text, flags=re.DOTALL)
    # Remove inline code
    text = re.sub(r"`[^`]+`", "", text)
    # Remove images
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", text)
    # Remove links but keep text
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    # Remove headers markers
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Remove emphasis
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"_([^_]+)_", r"\1", text)
    # Remove blockquotes
    text = re.sub(r"^>\s*", "", text, flags=re.MULTILINE)
    # Remove list markers
    text = re.sub(r"^[\-\*\+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\d+\.\s+", "", text, flags=re.MULTILINE)
    # Remove HTML tags
    text = re.sub(r"<[^>]+>", "", text)
    # Clean up whitespace
    text = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    return text


def chunk_text(text: str, max_chars: int = 800) -> List[str]:
    """Split text into chunks of approximately max_chars."""
    if len(text) <= max_chars:
        return [text] if text else []

    chunks = []
    paragraphs = text.split("\n\n")
    current_chunk = ""

    for para in paragraphs:
        if len(current_chunk) + len(para) + 2 <= max_chars:
            current_chunk = current_chunk + "\n\n" + para if current_chunk else para
        else:
            if current_chunk:
                chunks.append(current_chunk)
            # If paragraph itself is too long, split it
            if len(para) > max_chars:
                words = para.split()
                current_chunk = ""
                for word in words:
                    if len(current_chunk) + len(word) + 1 <= max_chars:
                        current_chunk = (
                            current_chunk + " " + word if current_chunk else word
                        )
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                        current_chunk = word
            else:
                current_chunk = para

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def read_manifest() -> List[Dict[str, Any]]:
    """Read and parse posts-manifest.json."""
    with MANIFEST_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    items = data.get("items", [])
    return [
        item
        for item in items
        if isinstance(item, dict)
        and item.get("published") is not False
        and isinstance(item.get("path"), str)
    ]


def prepare_documents(item: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Prepare documents (with chunking) for a single post."""
    rel_path = str(item.get("path", "")).lstrip("/")
    file_path = (PUBLIC_DIR / rel_path).resolve()

    if not file_path.is_file():
        print(f"  [SKIP] File not found: {rel_path}")
        return []

    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        text = strip_markdown(content)

        if not text or len(text) < 50:
            print(f"  [SKIP] Empty or too short: {rel_path}")
            return []

        # Create chunks
        chunks = chunk_text(text, MAX_CONTENT_CHARS)

        # Base document ID
        base_id = item.get("url") or item.get("path") or str(file_path)

        documents = []
        for i, chunk in enumerate(chunks):
            if not chunk.strip():
                continue

            doc_id = f"{base_id}#chunk{i}" if len(chunks) > 1 else base_id

            documents.append(
                {
                    "id": doc_id,
                    "content": chunk.strip(),
                    "metadata": {
                        "url": item.get("url"),
                        "title": item.get("title"),
                        "path": item.get("path"),
                        "slug": item.get("slug"),
                        "year": item.get("year"),
                        "tags": json.dumps(item.get("tags", [])),
                        "category": item.get("category"),
                        "date": item.get("date"),
                        "author": item.get("author"),
                        "chunk_index": i,
                        "chunk_count": len(chunks),
                    },
                }
            )

        return documents
    except Exception as e:
        print(f"  [ERROR] Failed to process {rel_path}: {e}")
        return []


def index_batch(documents: List[Dict[str, Any]]) -> bool:
    """Index a batch of documents via the Backend API."""
    try:
        data = json.dumps({"documents": documents}).encode("utf-8")
        req = Request(
            INDEX_ENDPOINT,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
            if result.get("ok"):
                indexed = result.get("data", {}).get("indexed", 0)
                print(f"  [OK] Indexed {indexed} documents")
                return True
            else:
                print(f"  [FAIL] API error: {result.get('error')}")
                return False
    except HTTPError as e:
        error_body = e.read().decode("utf-8")[:300]
        print(f"  [FAIL] HTTP {e.code}: {error_body}")
        return False
    except URLError as e:
        print(f"  [ERROR] Connection failed: {e.reason}")
        return False
    except Exception as e:
        print(f"  [ERROR] Request failed: {e}")
        return False


def main():
    print(f"=== RAG Indexing via Backend API ===")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Manifest: {MANIFEST_PATH}")
    print(f"Batch Size: {BATCH_SIZE}")
    print(f"Max Content Chars: {MAX_CONTENT_CHARS}")
    print()

    # Read manifest
    items = read_manifest()
    print(f"Found {len(items)} posts in manifest")

    # Prepare all documents (with chunking)
    all_documents = []
    for item in items:
        docs = prepare_documents(item)
        all_documents.extend(docs)

    print(f"\nPrepared {len(all_documents)} document chunks for indexing")
    print()

    if not all_documents:
        print("No documents to index!")
        return 1

    # Index in batches
    total_indexed = 0
    failed_batches = 0

    for i in range(0, len(all_documents), BATCH_SIZE):
        batch = all_documents[i : i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(all_documents) + BATCH_SIZE - 1) // BATCH_SIZE

        print(f"[Batch {batch_num}/{total_batches}] Indexing {len(batch)} chunks...")

        if index_batch(batch):
            total_indexed += len(batch)
        else:
            failed_batches += 1

    print()
    print(f"=== Indexing Complete ===")
    print(f"Total indexed: {total_indexed}/{len(all_documents)}")
    print(f"Failed batches: {failed_batches}")

    return 0 if failed_batches == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
