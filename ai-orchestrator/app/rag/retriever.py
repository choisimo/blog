"""RAG (Retrieval-Augmented Generation) retriever using ChromaDB.

Provides vector similarity search over blog posts and generates
context-aware answers using retrieved documents.
"""

from dataclasses import dataclass, field

import httpx
import structlog

from app.config import get_settings
from app.tools.llm import get_llm_client

logger = structlog.get_logger()


@dataclass
class RAGResult:
    """Result from a RAG query."""
    
    answer: str
    sources: list[dict] = field(default_factory=list)
    metadata: dict | None = None


async def get_embedding(text: str) -> list[float]:
    """Get embedding vector for text using TEI server.
    
    Args:
        text: Text to embed
        
    Returns:
        Embedding vector as list of floats
    """
    settings = get_settings()
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{settings.tei_url}/embed",
            json={"inputs": text},
        )
        response.raise_for_status()
        
        # TEI returns [[embedding]] for single input
        result = response.json()
        if isinstance(result, list) and len(result) > 0:
            if isinstance(result[0], list):
                return result[0]
            return result
        raise ValueError("Unexpected embedding response format")


async def search_chroma(
    query_embedding: list[float],
    collection: str,
    top_k: int = 5,
) -> list[dict]:
    """Search ChromaDB for similar documents.
    
    Args:
        query_embedding: Query vector
        collection: ChromaDB collection name
        top_k: Number of results to return
        
    Returns:
        List of document dicts with id, content, metadata, and distance
    """
    settings = get_settings()
    
    async with httpx.AsyncClient(timeout=30) as client:
        # Query ChromaDB API
        response = await client.post(
            f"{settings.chroma_url}/api/v1/collections/{collection}/query",
            json={
                "query_embeddings": [query_embedding],
                "n_results": top_k,
                "include": ["documents", "metadatas", "distances"],
            },
        )
        response.raise_for_status()
        result = response.json()
        
        documents = []
        
        # Parse ChromaDB response format
        if result.get("ids") and result["ids"][0]:
            ids = result["ids"][0]
            docs = result.get("documents", [[]])[0]
            metadatas = result.get("metadatas", [[]])[0]
            distances = result.get("distances", [[]])[0]
            
            for i, doc_id in enumerate(ids):
                documents.append({
                    "id": doc_id,
                    "content": docs[i] if i < len(docs) else "",
                    "metadata": metadatas[i] if i < len(metadatas) else {},
                    "distance": distances[i] if i < len(distances) else 0,
                })
        
        return documents


async def generate_answer(query: str, context_docs: list[dict]) -> str:
    """Generate an answer using retrieved context.
    
    Args:
        query: User's question
        context_docs: Retrieved documents for context
        
    Returns:
        Generated answer string
    """
    settings = get_settings()
    client = get_llm_client()
    
    # Build context from documents
    context_parts = []
    for i, doc in enumerate(context_docs, 1):
        title = doc.get("metadata", {}).get("title", f"Document {i}")
        content = doc.get("content", "")[:2000]  # Limit context per doc
        context_parts.append(f"[{i}] {title}\n{content}")
    
    context = "\n\n---\n\n".join(context_parts)
    
    system_prompt = """You are a helpful assistant that answers questions based on the provided context.

Rules:
1. Only use information from the provided context
2. If the context doesn't contain relevant information, say so
3. Cite sources by their number [1], [2], etc.
4. Be concise but thorough

Context:
{context}""".format(context=context)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": query},
    ]
    
    response = await client.acompletion(
        model=settings.default_chat_model,
        messages=messages,
        temperature=0.3,
        max_tokens=1000,
    )
    
    return response.choices[0].message.content or ""


async def query_rag(
    query: str,
    top_k: int = 5,
    collection: str | None = None,
) -> RAGResult:
    """Execute a RAG query: embed, retrieve, generate.
    
    Args:
        query: User's question
        top_k: Number of documents to retrieve
        collection: ChromaDB collection name (uses default if not specified)
        
    Returns:
        RAGResult with answer and source documents
    """
    settings = get_settings()
    collection_name = collection or settings.chroma_collection
    
    logger.info("rag_query_start", query_length=len(query), top_k=top_k, collection=collection_name)
    
    try:
        # Step 1: Get query embedding
        query_embedding = await get_embedding(query)
        logger.debug("rag_embedding_complete", vector_dim=len(query_embedding))
        
        # Step 2: Search ChromaDB
        documents = await search_chroma(query_embedding, collection_name, top_k)
        logger.debug("rag_search_complete", num_docs=len(documents))
        
        if not documents:
            return RAGResult(
                answer="I couldn't find any relevant documents to answer your question.",
                sources=[],
                metadata={"collection": collection_name, "num_results": 0},
            )
        
        # Step 3: Generate answer
        answer = await generate_answer(query, documents)
        logger.info("rag_query_complete", num_sources=len(documents))
        
        # Format sources for response
        sources = [
            {
                "id": doc["id"],
                "title": doc.get("metadata", {}).get("title", "Unknown"),
                "url": doc.get("metadata", {}).get("url"),
                "excerpt": doc.get("content", "")[:200],
                "distance": doc.get("distance"),
            }
            for doc in documents
        ]
        
        return RAGResult(
            answer=answer,
            sources=sources,
            metadata={
                "collection": collection_name,
                "num_results": len(documents),
            },
        )
        
    except httpx.HTTPStatusError as e:
        logger.error("rag_http_error", status=e.response.status_code, detail=str(e))
        raise
    except Exception as e:
        logger.error("rag_query_error", error=str(e))
        raise
