// ---------------------------------------------------------------------------
// RAG infrastructure for chat — extracted from routes/chat.js
// ---------------------------------------------------------------------------

import { config } from "../config.js";
import { openaiEmbeddings } from "../lib/openai-compat-client.js";
import { CHROMA } from "../config/constants.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("chat-rag");

const ragCollectionCache = new Map();

/**
 * Format page context metadata into a human-readable string block.
 * @param {object|null} pageContext
 * @returns {string|null}
 */
export function formatPageContext(pageContext) {
  if (!pageContext || typeof pageContext !== "object") {
    return null;
  }

  const lines = [];
  const title =
    typeof pageContext.title === "string" ? pageContext.title.trim() : "";
  const url = typeof pageContext.url === "string" ? pageContext.url.trim() : "";

  if (title || url) {
    lines.push(`[Context: ${title || ""} - ${url || ""}]`);
  }

  const article =
    pageContext.article && typeof pageContext.article === "object"
      ? pageContext.article
      : null;

  if (article) {
    const articleTitle =
      typeof article.title === "string" ? article.title.trim() : "";
    const slug = typeof article.slug === "string" ? article.slug.trim() : "";
    const year = typeof article.year === "string" ? article.year.trim() : "";
    const description =
      typeof article.description === "string"
        ? article.description.trim()
        : "";
    const headings = Array.isArray(article.headings)
      ? article.headings
          .filter((value) => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];

    if (articleTitle) {
      lines.push(`[Current Article Title] ${articleTitle}`);
    }
    if (year && slug) {
      lines.push(`[Current Article Slug] ${year}/${slug}`);
    } else if (slug) {
      lines.push(`[Current Article Slug] ${slug}`);
    }
    if (description) {
      lines.push(`[Current Article Description] ${description}`);
    }
    if (headings.length > 0) {
      lines.push(`[Current Article Headings] ${headings.join(" | ")}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

// ---------------------------------------------------------------------------
// ChromaDB helpers
// ---------------------------------------------------------------------------

function getChromaCollectionsBase() {
  return `${config.rag.chromaUrl}/api/v2/tenants/${CHROMA.TENANT}/databases/${CHROMA.DATABASE}/collections`;
}

async function getCollectionUUID(collectionName) {
  if (ragCollectionCache.has(collectionName)) {
    return ragCollectionCache.get(collectionName);
  }

  try {
    const collectionsUrl = getChromaCollectionsBase();
    const listResp = await fetch(collectionsUrl, { method: "GET" });

    if (!listResp.ok) return null;

    const collections = await listResp.json();
    const collection = collections.find((c) => c.name === collectionName);

    if (collection) {
      ragCollectionCache.set(collectionName, collection.id);
      return collection.id;
    }
  } catch {
    return null;
  }
  return null;
}

async function getEmbeddings(texts) {
  const result = await openaiEmbeddings(texts, {
    model: config.rag.embeddingModel,
    baseUrl: config.rag.embeddingUrl,
    apiKey: config.rag.embeddingApiKey,
  });

  return result.embeddings;
}

async function queryChroma(embedding, nResults = 5, where = null) {
  const collectionName = config.rag.chromaCollection;
  const collectionsBase = getChromaCollectionsBase();

  const collectionUUID = await getCollectionUUID(collectionName);
  if (!collectionUUID) {
    throw new Error(`Collection not found: ${collectionName}`);
  }

  const queryUrl = `${collectionsBase}/${collectionUUID}/query`;
  const body = {
    query_embeddings: [embedding],
    n_results: nResults,
    include: ["documents", "metadatas", "distances"],
  };
  if (where) {
    body.where = where;
  }

  const response = await fetch(queryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`ChromaDB error: ${response.status}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Main RAG search export
// ---------------------------------------------------------------------------

/**
 * Perform a RAG search against the blog posts ChromaDB collection.
 * @param {string} query
 * @param {number} [topK=5]
 * @param {string|null} [articleSlug=null]
 * @param {string|null} [articleYear=null]
 * @returns {Promise<{context: string|null, sources: Array}>}
 */
export async function performRAGSearch(query, topK = 5, articleSlug = null, articleYear = null) {
  try {
    const [embedding] = await getEmbeddings([query]);

    let where = null;
    if (articleSlug) {
      where = articleYear
        ? { $and: [{ slug: { $eq: articleSlug } }, { year: { $eq: articleYear } }] }
        : { slug: { $eq: articleSlug } };
    }

    const chromaResult = await queryChroma(embedding, topK, where);

    const sources = [];
    const contextParts = [];

    if (chromaResult.documents && chromaResult.documents[0]) {
      const docs = chromaResult.documents[0];
      const metas = chromaResult.metadatas?.[0] || [];
      const dists = chromaResult.distances?.[0] || [];

      for (let i = 0; i < docs.length; i++) {
        const meta = metas[i] || {};
        const distance = dists[i];
        const score = distance != null ? Math.max(0, 1 - distance) : null;

        sources.push({
          title: meta.title || meta.post_title || "Untitled",
          url: meta.slug
            ? `/posts/${meta.year || new Date().getFullYear()}/${meta.slug}`
            : undefined,
          score,
          snippet: docs[i]?.slice(0, 200) || "",
        });

        const title = meta.title || meta.post_title || "";
        contextParts.push(
          `[${i + 1}] ${title ? `"${title}": ` : ""}${docs[i]}`,
        );
      }
    }

    const context =
      contextParts.length > 0
        ? `다음은 관련 블로그 포스트에서 발췌한 내용입니다:\n\n${contextParts.join("\n\n")}\n\n위 내용을 참고하여 답변해주세요.`
        : null;

    return { context, sources };
  } catch (err) {
    logger.warn({}, 'RAG search failed', { error: err.message });
    return { context: null, sources: [] };
  }
}
