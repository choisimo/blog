import os
import json
import hashlib
import logging
from datetime import datetime
from urllib.parse import urlparse
from pathlib import Path
from typing import Any, Dict, List, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import chromadb
from chromadb.config import Settings
from bs4 import BeautifulSoup
import markdown as md
try:
    import tiktoken  # type: ignore
except Exception:  # pragma: no cover
    tiktoken = None
import time
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def read_manifest(manifest_path: Path) -> List[Dict[str, Any]]:
    with manifest_path.open('r', encoding='utf-8') as f:
        data = json.load(f)
    items = data.get('items') or []
    out = []
    for it in items:
        if not isinstance(it, dict):
            continue
        if it.get('published') is False:
            continue
        p = it.get('path')
        if not isinstance(p, str):
            continue
        out.append(it)
    return out


def markdown_to_text(markdown_str: str) -> str:
    html = md.markdown(markdown_str)
    soup = BeautifulSoup(html, 'html.parser')
    text = soup.get_text('\n')
    text = '\n'.join([ln.strip() for ln in text.splitlines()])
    text = '\n'.join([ln for ln in text.splitlines() if ln])
    return text


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 150) -> List[str]:
    if chunk_size <= 0:
        return [text]
    if overlap < 0:
        overlap = 0
    out: List[str] = []
    n = len(text)
    i = 0
    while i < n:
        j = min(i + chunk_size, n)
        out.append(text[i:j])
        if j >= n:
            break
        i = max(j - overlap, 0)
    return out


def get_tokenizer():
    if tiktoken is None:
        return None
    try:
        # cl100k_base is commonly used (GPT-4/3.5). Serves as a reasonable proxy.
        return tiktoken.get_encoding('cl100k_base')
    except Exception:
        return None


def chunk_by_tokens(text: str, tokens_per_chunk: int = 512, overlap_tokens: int = 80) -> List[str]:
    enc = get_tokenizer()
    if enc is None or tokens_per_chunk <= 0:
        # Fallback to char-based
        approx_char = max(200, tokens_per_chunk * 2)
        approx_overlap = max(0, overlap_tokens * 2)
        return chunk_text(text, chunk_size=approx_char, overlap=approx_overlap)
    toks = enc.encode(text, disallowed_special=())
    out: List[str] = []
    step = max(1, tokens_per_chunk - max(0, overlap_tokens))
    i = 0
    n = len(toks)
    while i < n:
        j = min(i + tokens_per_chunk, n)
        chunk_tokens = toks[i:j]
        out.append(enc.decode(chunk_tokens))
        if j >= n:
            break
        i = max(j - overlap_tokens, i + step)
    return out


def stable_chunk_id(base: str, idx: int, content: str) -> str:
    h = hashlib.sha1()
    h.update(base.encode('utf-8'))
    h.update(b'\n')
    h.update(str(idx).encode('utf-8'))
    h.update(b'\n')
    h.update(content.encode('utf-8'))
    return h.hexdigest()


def get_cf_access_headers() -> Dict[str, str]:
    client_id = os.environ.get('CF_ACCESS_CLIENT_ID', '').strip()
    client_secret = os.environ.get('CF_ACCESS_CLIENT_SECRET', '').strip()
    headers: Dict[str, str] = {}
    if client_id:
        headers['CF-Access-Client-Id'] = client_id
    if client_secret:
        headers['CF-Access-Client-Secret'] = client_secret
    return headers


def create_session(total_retries: int = 5, backoff_factor: float = 1.0, status_forcelist: List[int] | None = None) -> requests.Session:
    if status_forcelist is None:
        status_forcelist = [429, 500, 502, 503, 504]
    retry = Retry(
        total=total_retries,
        read=total_retries,
        connect=total_retries,
        status=total_retries,
        backoff_factor=backoff_factor,
        status_forcelist=status_forcelist,
        allowed_methods=["GET", "POST", "PUT", "DELETE"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    sess = requests.Session()
    sess.mount("http://", adapter)
    sess.mount("https://", adapter)
    return sess


def embed_texts(session: requests.Session, tei_url: str, inputs: List[str], batch_size: int = 32, timeout: int = 120) -> List[List[float]]:
    out: List[List[float]] = []
    for i in range(0, len(inputs), batch_size):
        batch = inputs[i:i + batch_size]
        resp = session.post(tei_url, json={"inputs": batch}, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        embs = data.get('embeddings')
        if not isinstance(embs, list):
            raise RuntimeError('Invalid TEI response')
        if len(embs) != len(batch):
            raise RuntimeError('Mismatched embedding count')
        out.extend(embs)
    return out


def connect_chroma(chroma_url: str, cf_headers: Dict[str, str] | None = None) -> chromadb.Client:
    u = urlparse(chroma_url)
    host = u.hostname or 'localhost'
    port = u.port or (443 if u.scheme == 'https' else 8000)
    ssl_enabled = (u.scheme == 'https')
    settings_kwargs: Dict[str, Any] = {
        'chroma_server_host': host,
        'chroma_server_http_port': port,
        'chroma_server_ssl_enabled': ssl_enabled,
        'anonymized_telemetry': False,
    }
    if cf_headers:
        settings_kwargs['chroma_server_headers'] = cf_headers
    try:
        settings = Settings(**settings_kwargs)
    except TypeError:
        settings_kwargs.pop('chroma_server_headers', None)
        settings = Settings(**settings_kwargs)
    # chromadb 0.6 moved the public HTTP client to chromadb.HttpClient.
    http_client_cls = getattr(chromadb, "HttpClient", None)
    if http_client_cls is not None:
        client_kwargs: Dict[str, Any] = {
            'host': host,
            'port': port,
            'ssl': ssl_enabled,
            'settings': settings,
        }
        if cf_headers:
            client_kwargs['headers'] = cf_headers
        try:
            return http_client_cls(**client_kwargs)
        except TypeError:
            client_kwargs.pop('headers', None)
            try:
                return http_client_cls(**client_kwargs)
            except TypeError:
                # In case the installed chromadb expects different kwargs (older versions), fall back.
                pass
    return chromadb.Client(settings)


def get_collection(client: chromadb.Client, name: str):
    return client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})


def chroma_delete_with_retry(collection, where: Dict[str, Any], attempts: int = 4, backoff_s: float = 1.5) -> None:
    last_err: Exception | None = None
    for k in range(attempts):
        try:
            collection.delete(where=where)
            return
        except Exception as e:  # pragma: no cover
            last_err = e
            time.sleep(backoff_s * (2 ** k))
    if last_err:
        raise last_err


def chroma_upsert_with_retry(collection, ids: List[str], embeddings: List[List[float]], metadatas: List[Dict[str, Any]], documents: List[str], attempts: int = 4, backoff_s: float = 1.5) -> None:
    last_err: Exception | None = None
    for k in range(attempts):
        try:
            collection.upsert(ids=ids, embeddings=embeddings, metadatas=metadatas, documents=documents)
            return
        except Exception as e:  # pragma: no cover
            last_err = e
            time.sleep(backoff_s * (2 ** k))
    if last_err:
        raise last_err


def process_document(
    file_path: Path,
    item: Dict[str, Any],
    tei_url: str,
    total_retries: int,
    retry_backoff: float,
    tokens_per_chunk: int,
    overlap_tokens: int,
    embed_batch: int,
    embed_timeout: int,
    cf_headers: Dict[str, str] | None,
) -> Tuple[str, List[str], List[List[float]], List[Dict[str, Any]], List[str]]:
    """
    Worker function to process a single markdown file into chunks and embeddings.
    Returns a tuple of (doc_id, ids, embeddings, metadatas, documents).
    """
    # read file
    content = file_path.read_text(encoding='utf-8', errors='ignore')
    text = markdown_to_text(content)
    chunks = chunk_by_tokens(text, tokens_per_chunk=tokens_per_chunk, overlap_tokens=overlap_tokens)
    if not chunks:
        return ("", [], [], [], [])

    doc_id = str(item.get('url') or item.get('path') or file_path.as_posix())

    # Per-worker session to avoid cross-thread Session usage
    session = create_session(total_retries=total_retries, backoff_factor=retry_backoff)
    if cf_headers:
        session.headers.update(cf_headers)
    try:
        embeddings = embed_texts(session, tei_url, chunks, batch_size=embed_batch, timeout=embed_timeout)
    finally:
        session.close()

    base_id = doc_id
    ids = [stable_chunk_id(base_id, i, ch) for i, ch in enumerate(chunks)]
    metadatas: List[Dict[str, Any]] = []
    indexed_at = datetime.utcnow().isoformat() + 'Z'
    source_path = str(file_path)

    for i, ch in enumerate(chunks):
        metadatas.append({
            "doc_id": doc_id,
            "url": item.get('url'),
            "title": item.get('title'),
            "path": item.get('path'),
            "slug": item.get('slug'),
            "year": item.get('year'),
            "tags": item.get('tags'),
            "category": item.get('category'),
            "date": item.get('date'),
            "chunk_index": i,
            "chunk_count": len(chunks),
            "source": source_path,
            "chunk_text": ch,
            "created_at": indexed_at,
        })
    documents = chunks
    return (doc_id, ids, embeddings, metadatas, documents)


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    manifest_rel = os.environ.get('POSTS_MANIFEST', 'frontend/public/posts-manifest.json')
    manifest_path = (repo_root / manifest_rel).resolve()
    public_dir = (repo_root / 'frontend/public').resolve()

    items = read_manifest(manifest_path)

    tei_url = os.environ.get('TEI_URL', '').strip()
    if not tei_url:
        raise SystemExit('Missing TEI_URL')
    chroma_url = os.environ.get('CHROMA_URL', '').strip()
    if not chroma_url:
        raise SystemExit('Missing CHROMA_URL')
    # Dynamic collection naming: prefer explicit CHROMA_COLLECTION, else base + model
    base_collection = os.environ.get('BASE_COLLECTION_NAME', 'blog-posts').strip() or 'blog-posts'
    tei_model_name = os.environ.get('TEI_MODEL_NAME', os.environ.get('TEI_MODEL', 'all-MiniLM-L6-v2')).strip() or 'all-MiniLM-L6-v2'
    explicit_collection = os.environ.get('CHROMA_COLLECTION', '').strip()
    collection_name = explicit_collection if explicit_collection else f"{base_collection}__{tei_model_name}"

    cf_headers = get_cf_access_headers()

    client = connect_chroma(chroma_url, cf_headers=cf_headers if cf_headers else None)
    collection = get_collection(client, collection_name)
    # Configure retries/timeouts from env
    total_retries = int(os.environ.get('RETRIES_TOTAL', '5'))
    retry_backoff = float(os.environ.get('RETRY_BACKOFF_S', '1.0'))
    chroma_attempts = int(os.environ.get('CHROMA_RETRIES', '4'))
    chroma_backoff = float(os.environ.get('CHROMA_BACKOFF_S', '1.5'))
    embed_timeout = int(os.environ.get('EMBED_TIMEOUT_S', '120'))
    embed_batch = int(os.environ.get('EMBED_BATCH', '32'))
    # token chunking params
    tokens_per_chunk = int(os.environ.get('CHUNK_TOKENS', '512'))
    overlap_tokens = int(os.environ.get('CHUNK_OVERLAP_TOKENS', '80'))
    # Concurrency
    max_workers = int(os.environ.get('MAX_WORKERS', '6'))
    # Prepare jobs (and perform doc-level deletes up-front in main thread)
    jobs: List[Tuple[str, Path, Dict[str, Any]]] = []
    for it in items:
        rel_path = str(it.get('path', '')).lstrip('/')
        file_path = (public_dir / rel_path).resolve()
        if not file_path.is_file():
            continue
        doc_id = str(it.get('url') or it.get('path') or file_path.as_posix())
        # Idempotent delete for this doc (and legacy keys) before re-insert
        try:
            chroma_delete_with_retry(collection, {"doc_id": doc_id}, attempts=chroma_attempts, backoff_s=chroma_backoff)
        except Exception:
            pass
        try:
            if it.get('url'):
                chroma_delete_with_retry(collection, {"url": it.get('url')}, attempts=chroma_attempts, backoff_s=chroma_backoff)
        except Exception:
            pass
        try:
            if it.get('path'):
                chroma_delete_with_retry(collection, {"path": it.get('path')}, attempts=chroma_attempts, backoff_s=chroma_backoff)
        except Exception:
            pass
        jobs.append((doc_id, file_path, it))

    # Run embeddings in parallel; upsert results serially to avoid client thread-safety concerns
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {
            ex.submit(
                process_document,
                file_path,
                it,
                tei_url,
                total_retries,
                retry_backoff,
                tokens_per_chunk,
                overlap_tokens,
                embed_batch,
                embed_timeout,
                cf_headers,
            ): (doc_id, file_path, it)
            for doc_id, file_path, it in jobs
        }
        for fut in as_completed(futures):
            ctx_doc_id, ctx_file_path, ctx_item = futures[fut]
            try:
                doc_id, ids, embeddings, metadatas, documents = fut.result()
                if ids and embeddings and metadatas and documents:
                    chroma_upsert_with_retry(
                        collection,
                        ids=ids,
                        embeddings=embeddings,
                        metadatas=metadatas,
                        documents=documents,
                        attempts=chroma_attempts,
                        backoff_s=chroma_backoff,
                    )
            except Exception as exc:
                logger.exception(
                    "Failed to process document %s (path=%s): %s",
                    ctx_doc_id,
                    ctx_item.get('path'),
                    exc,
                )
                continue


if __name__ == '__main__':
    main()
