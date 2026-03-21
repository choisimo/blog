# News Service Analysis

**Date:** 2026-03-18  
**Scope:** Entire `blog/` monorepo

## Summary

There is **no dedicated news service** in this codebase. News/current-events retrieval is handled entirely through the AI agent's `web_search` tool, which supports multiple external search providers.

---

## Finding 1: No Standalone News Service

No dedicated module, route, or service file exists for news aggregation, RSS feeds, or news API integration. Searches across the entire codebase for `news`, `rss`, `feed`, `headline`, `article` (outside of blog post context) returned no results indicating a standalone news service.

---

## Finding 2: Web Search Tool is the News Mechanism

**File:** `backend/src/services/agent/tools/web-search.tool.js`

The AI agent's `web_search` tool is the sole mechanism for fetching current/external information. It supports five search engines selectable per-request:

| Engine | API Endpoint | Use Case | Default |
|--------|-------------|----------|---------|
| `perplexity` | `https://api.perplexity.ai/chat/completions` | AI-synthesized answers with citations | No |
| `tavily` | `https://api.tavily.com/search` | AI-optimized agent search, structured results | **Yes** |
| `duckduckgo` | `https://api.duckduckgo.com/` (env: `SEARCH_API_URL`) | Free, no API key | No |
| `brave` | `https://api.search.brave.com/res/v1/web/search` | Brave Search API | No |
| `serper` | `https://google.serper.dev/search` | Google results via Serper proxy | No |

**Supported actions:** `search`, `fetch_page`

---

## Finding 3: Perplexity Configuration

Perplexity is configured in `backend/src/config/index.js`:

```js
perplexityApiKey: raw.PERPLEXITY_API_KEY
```

Environment variable: `PERPLEXITY_API_KEY`

Perplexity is called directly (not via the OpenAI-compat client) using the model `llama-3.1-sonar-small-128k-online`, which has live web access. This is the only provider in the codebase that returns real-time external content natively.

---

## Finding 4: Tavily is the Current Default

The default search engine is `tavily` (line 283 of `web-search.tool.js`). Tavily is designed for AI agent use cases, returning structured `{ answer, results[] }` responses with metadata like `score`, `published_date`, and `content`.

Environment variable: `TAVILY_API_KEY`

---

## Usage Status

| Component | Status | Notes |
|-----------|--------|-------|
| `web_search` tool | **Active** — used by agent | Entry point for all external search |
| Perplexity | Conditionally active | Requires `PERPLEXITY_API_KEY` env var |
| Tavily | Conditionally active (default) | Requires `TAVILY_API_KEY` env var |
| DuckDuckGo | Conditionally active | Free, no key required |
| Brave Search | Conditionally active | Requires `BRAVE_SEARCH_API_KEY` env var |
| Serper | Conditionally active | Requires `SERPER_API_KEY` env var |

The `web_search` tool is called by the Agent Coordinator (`backend/src/services/agent/coordinator.service.js`) when the agent decides a web search is needed to answer a user query.

---

## Conclusion

No news service needs to be built or modified. If real-time news retrieval is needed, it is already available via the agent's `web_search` tool with Tavily (default) or Perplexity. To enable, set the appropriate API key environment variable (`TAVILY_API_KEY` or `PERPLEXITY_API_KEY`).
