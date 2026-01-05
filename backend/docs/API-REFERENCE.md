# API Reference

Complete REST API reference for the Blog Backend.

**Base URL:** `https://api.nodove.com` (via Cloudflare Workers)  
**Internal URL:** `http://localhost:5080` (direct backend access)

All responses follow the format:
```json
{
  "ok": true|false,
  "data": { ... },
  "error": "error message (if ok=false)"
}
```

---

## Table of Contents

- [Health & Config](#health--config)
- [Posts API](#posts-api)
- [Images API](#images-api)
- [Comments API](#comments-api)
- [Analytics API](#analytics-api)
- [AI API](#ai-api)
- [Agent API](#agent-api)
- [RAG API](#rag-api)
- [Chat API](#chat-api)
- [Translate API](#translate-api)
- [Auth API](#auth-api)
- [Admin APIs](#admin-apis)
- [Aidove Proxy](#aidove-proxy)

---

## Health & Config

### GET /api/v1/healthz

Health check endpoint.

**Response:**
```json
{
  "ok": true,
  "env": "production",
  "uptime": 12345.67
}
```

### GET /api/v1/public/config

Get public runtime configuration.

**Response:**
```json
{
  "ok": true,
  "data": {
    "siteBaseUrl": "https://noblog.nodove.com",
    "apiBaseUrl": "https://api.nodove.com"
  }
}
```

---

## Posts API

Base path: `/api/v1/posts`

### GET /api/v1/posts

List blog posts.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `year` | string | Filter by year (YYYY) |
| `includeDrafts` | boolean | Include unpublished posts (default: false) |
| `limit` | number | Max results to return |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "path": "/posts/2024/my-post.md",
        "year": "2024",
        "slug": "my-post",
        "title": "My Post",
        "description": "Post description...",
        "date": "2024-01-15",
        "tags": ["tech", "tutorial"],
        "category": "Development",
        "author": "Admin",
        "readingTime": "5 min read",
        "published": true,
        "url": "/blog/2024/my-post"
      }
    ]
  },
  "source": "filesystem|remote"
}
```

### GET /api/v1/posts/:year/:slug

Get single post with markdown content.

**Response:**
```json
{
  "ok": true,
  "data": {
    "item": { ... },
    "markdown": "---\ntitle: My Post\n---\n\nPost content..."
  },
  "source": "filesystem|remote"
}
```

### POST /api/v1/posts

Create new post. **Requires admin auth.**

**Request Body:**
```json
{
  "title": "New Post Title",
  "slug": "new-post",
  "year": "2024",
  "content": "# Markdown content...",
  "frontmatter": {
    "tags": ["tech"],
    "category": "Tutorial",
    "published": true
  }
}
```

### PUT /api/v1/posts/:year/:slug

Update existing post. **Requires admin auth.**

**Request Body:**
```json
{
  "markdown": "---\ntitle: Updated\n---\n\nNew content...",
  // OR
  "frontmatter": { "tags": ["updated"] },
  "content": "New content..."
}
```

### DELETE /api/v1/posts/:year/:slug

Delete post. **Requires admin auth.**

### POST /api/v1/posts/regenerate-manifests

Regenerate all post manifests. **Requires admin auth.**

---

## Images API

Base path: `/api/v1/images`

### POST /api/v1/images/upload

Upload images for blog posts. **Requires admin auth.**

**Request:** `multipart/form-data`
| Field | Type | Description |
|-------|------|-------------|
| `files` | File[] | Image files (max 10, max 20MB each) |
| `year` | string | Target year directory |
| `slug` | string | Target post slug |
| `subdir` | string | Alternative subdirectory path |

**Response:**
```json
{
  "ok": true,
  "data": {
    "dir": "/images/2024/my-post",
    "items": [
      {
        "filename": "image.jpg",
        "path": "2024/my-post/image.jpg",
        "url": "/images/2024/my-post/image.jpg",
        "sizeBytes": 123456,
        "variantWebp": {
          "filename": "image-w1600.webp",
          "url": "/images/2024/my-post/image-w1600.webp"
        }
      }
    ]
  }
}
```

### GET /api/v1/images

List images in directory. **Requires admin auth.**

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `year` | string | Year directory |
| `slug` | string | Post slug |
| `dir` | string | Alternative directory path |

### DELETE /api/v1/images/:year/:slug/:filename

Delete image and its variants. **Requires admin auth.**

### POST /api/v1/images/chat-upload

Upload image for AI chat with vision analysis.

**Request:** `multipart/form-data`
| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Image file |

**Response:**
```json
{
  "ok": true,
  "data": {
    "url": "https://assets-b.nodove.com/ai-chat/...",
    "key": "ai-chat/...",
    "size": 123456,
    "contentType": "image/jpeg",
    "imageAnalysis": "Image description from vision model..."
  }
}
```

---

## Comments API

Base path: `/api/v1/comments`

### GET /api/v1/comments

Get comments for a post.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `postId` or `postSlug` or `slug` | string | Post identifier |

**Response:**
```json
{
  "ok": true,
  "data": {
    "comments": [
      {
        "id": "comment-uuid",
        "postId": "2024/my-post",
        "author": "John",
        "content": "Great post!",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 5
  }
}
```

### POST /api/v1/comments

Create new comment.

**Request Body:**
```json
{
  "postId": "2024/my-post",
  "author": "John",
  "content": "Great post!",
  "email": "john@example.com"
}
```

### GET /api/v1/comments/stream

SSE stream for live comments.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `postId` | string | Post identifier |

**Events:**
- `open` - Connection established
- `append` - New comments: `{ type: "append", items: [...] }`
- `ping` - Heartbeat
- `error` - Error occurred

### DELETE /api/v1/comments/:id

Delete comment (soft delete). **Requires admin auth.**

---

## Analytics API

Base path: `/api/v1/analytics`

### POST /api/v1/analytics/view

Record a page view.

**Request Body:**
```json
{
  "year": "2024",
  "slug": "my-post"
}
```

### GET /api/v1/analytics/stats/:year/:slug

Get stats for a specific post.

### GET /api/v1/analytics/editor-picks

Get active editor picks.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 3 | Max picks to return |

### GET /api/v1/analytics/trending

Get trending posts based on recent views.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 5 | Max posts to return |
| `days` | number | 7 | Days to consider |

### POST /api/v1/analytics/refresh-stats

Refresh 7d and 30d view counts. **Requires admin auth.**

---

## AI API

Base path: `/api/v1/ai`

### GET /api/v1/ai/models

List available AI models.

**Response:**
```json
{
  "ok": true,
  "data": {
    "models": [
      {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "provider": "OpenAI",
        "isDefault": true,
        "capabilities": ["chat", "vision", "streaming"]
      }
    ],
    "default": "gpt-4o",
    "provider": "database|n8n|fallback"
  }
}
```

### POST /api/v1/ai/auto-chat

Chat with automatic RAG integration.

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "What posts about React?" }
  ],
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 1000
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "content": "Here are some relevant posts...",
    "model": "gpt-4o",
    "provider": "n8n",
    "usedRAG": true
  }
}
```

### POST /api/v1/ai/vision/analyze

Analyze image with vision model.

**Request Body:**
```json
{
  "imageUrl": "https://assets-b.nodove.com/...",
  // OR
  "imageBase64": "base64-encoded-image",
  "mimeType": "image/jpeg",
  "prompt": "Describe this image"
}
```

### POST /api/v1/ai/summarize

Summarize text content.

**Request Body:**
```json
{
  "text": "Long text to summarize...",
  "instructions": "Focus on key points"
}
```

### POST /api/v1/ai/generate

Raw text generation.

**Request Body:**
```json
{
  "prompt": "Write a haiku about coding",
  "temperature": 0.7
}
```

### GET /api/v1/ai/generate/stream

SSE streaming generation.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `prompt` or `q` | string | Generation prompt |
| `temperature` | number | Temperature (0-1) |

**Events:**
- `open` - Stream started
- `token` - Token chunk: `{ token: "text" }`
- `done` - Generation complete
- `error` - Error occurred
- `ping` - Heartbeat

### POST /api/v1/ai/sketch

Extract emotional sketch from paragraph.

**Request Body:**
```json
{
  "paragraph": "Text content...",
  "postTitle": "Post title",
  "persona": "default"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "mood": "curious",
    "bullets": ["point 1", "point 2"]
  }
}
```

### POST /api/v1/ai/prism

Generate idea facets.

### POST /api/v1/ai/chain

Generate follow-up questions.

### GET /api/v1/ai/health

AI service health check.

### GET /api/v1/ai/status

Detailed AI service status.

---

## Agent API

Base path: `/api/v1/agent`

AI Agent with tools and memory.

### POST /api/v1/agent/run

Run agent with message (non-streaming).

**Request Body:**
```json
{
  "message": "Help me find posts about React hooks",
  "sessionId": "optional-session-id",
  "mode": "default|research|coding|blog|article|terminal",
  "articleSlug": "2024/my-post",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxIterations": 5,
  "userId": "user-id"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "response": "I found several posts about React hooks...",
    "sessionId": "sess-xxx",
    "toolsUsed": ["search_posts", "get_post"],
    "memoryUpdated": true,
    "model": "gpt-4o",
    "tokens": { "prompt": 100, "completion": 200, "total": 300 }
  }
}
```

### POST /api/v1/agent/stream

Run agent with streaming response (SSE).

**Events:**
- `open` - Connection established
- `token` - Text chunk: `{ token: "text" }`
- `tool_start` - Tool execution started: `{ tool: "name", id: "id" }`
- `tool_end` - Tool execution completed: `{ tool: "name", result: {...} }`
- `tool_error` - Tool execution failed
- `done` - Complete: `{ sessionId, toolsUsed, content }`
- `error` - Error occurred

### GET /api/v1/agent/session/:sessionId

Get session details.

### DELETE /api/v1/agent/session/:sessionId

Clear session.

### GET /api/v1/agent/sessions

List all sessions.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `userId` | string | default-user | User ID |
| `limit` | number | 20 | Max results |
| `offset` | number | 0 | Pagination offset |

### GET /api/v1/agent/health

Agent health check.

### GET /api/v1/agent/tools

List available tools.

### GET /api/v1/agent/modes

List available agent modes.

### POST /api/v1/agent/memory/extract

Extract memories from conversation.

### POST /api/v1/agent/memory/search

Search memories semantically.

---

## RAG API

Base path: `/api/v1/rag`

Vector search with ChromaDB and TEI embeddings.

### POST /api/v1/rag/search

Semantic search for blog posts.

**Request Body:**
```json
{
  "query": "React state management",
  "n_results": 5
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "results": [
      {
        "document": "Post content snippet...",
        "metadata": {
          "title": "React State Management",
          "url": "/blog/2024/react-state",
          "category": "React",
          "tags": "react,state"
        },
        "distance": 0.234
      }
    ]
  }
}
```

### POST /api/v1/rag/embed

Generate text embeddings.

**Request Body:**
```json
{
  "texts": ["text 1", "text 2"]
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "embeddings": [[0.1, 0.2, ...], [0.3, 0.4, ...]]
  }
}
```

### GET /api/v1/rag/health

RAG service health (TEI + ChromaDB).

### POST /api/v1/rag/memories/upsert

Store user memories with embeddings.

**Request Body:**
```json
{
  "userId": "user-id",
  "memories": [
    {
      "id": "mem-1",
      "content": "User prefers dark mode",
      "memoryType": "preference",
      "category": "ui"
    }
  ]
}
```

### POST /api/v1/rag/memories/search

Search user memories.

**Request Body:**
```json
{
  "userId": "user-id",
  "query": "user preferences",
  "n_results": 10,
  "memoryType": "preference"
}
```

### DELETE /api/v1/rag/memories/:userId/:memoryId

Delete memory embedding.

### POST /api/v1/rag/index

Index documents.

**Request Body:**
```json
{
  "documents": [
    {
      "id": "doc-1",
      "content": "Document content...",
      "metadata": { "title": "Doc Title" }
    }
  ],
  "collection": "optional-collection-name"
}
```

### GET /api/v1/rag/status

Get index status.

### GET /api/v1/rag/collections

List all ChromaDB collections.

---

## Chat API

Base path: `/api/v1/chat`

Session-based chat with AI tasks.

### POST /api/v1/chat/session

Create new chat session.

**Request Body:**
```json
{
  "title": "Session Title"
}
```

### POST /api/v1/chat/session/:sessionId/message

Send message (SSE streaming).

**Request Body:**
```json
{
  "parts": [{ "type": "text", "text": "Hello!" }],
  "context": {
    "page": { "url": "/blog/post", "title": "Post Title" }
  },
  "model": "gpt-4o"
}
```

### POST /api/v1/chat/session/:sessionId/task

Execute inline AI task.

**Request Body:**
```json
{
  "mode": "sketch|prism|chain|catalyst|summary|custom",
  "payload": {
    "paragraph": "Text to analyze...",
    "postTitle": "Post title"
  }
}
```

### POST /api/v1/chat/aggregate

Aggregate multiple session summaries.

---

## Translate API

Base path: `/api/v1/translate`

AI-powered translation with caching.

### POST /api/v1/translate

Translate blog post.

**Request Body:**
```json
{
  "year": "2024",
  "slug": "my-post",
  "targetLang": "en",
  "sourceLang": "ko",
  "title": "Post title",
  "description": "Post description",
  "content": "# Markdown content...",
  "forceRefresh": false
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "title": "Translated title",
    "description": "Translated description",
    "content": "# Translated content...",
    "cached": false,
    "isAiGenerated": true
  }
}
```

### GET /api/v1/translate/:year/:slug/:targetLang

Get cached translation.

### DELETE /api/v1/translate/:year/:slug/:targetLang

Delete cached translation.

---

## Auth API

Base path: `/api/v1/auth`

### POST /api/v1/auth/login

Admin login.

**Request Body:**
```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "token": "jwt-token"
  }
}
```

### GET /api/v1/auth/me

Verify token and get claims.

**Headers:** `Authorization: Bearer <token>`

---

## Admin APIs

### Admin Routes (`/api/v1/admin`)

**Requires admin auth.**

#### POST /api/v1/admin/propose-new-version

Create PR with post revision.

#### POST /api/v1/admin/archive-comments

Archive old comments to GitHub.

#### POST /api/v1/admin/create-post-pr

Create PR for new post.

### Config Admin (`/api/v1/admin/config`)

**Requires admin auth.**

- `GET /categories` - List config categories
- `GET /current` - Get current config values
- `POST /validate` - Validate config value
- `POST /export` - Export config (env/docker-compose/wrangler)
- `POST /save-env` - Save to .env file
- `GET /schema` - Get config schema

### Workers Admin (`/api/v1/admin/workers`)

**Requires admin auth.**

- `GET /list` - List Cloudflare Workers
- `GET /secrets` - List known secrets
- `GET /:workerId/config` - Get worker config
- `POST /:workerId/vars` - Update worker vars
- `POST /:workerId/secret` - Set worker secret
- `POST /:workerId/deploy` - Deploy worker
- `GET /d1/databases` - List D1 databases
- `GET /kv/namespaces` - List KV namespaces
- `GET /r2/buckets` - List R2 buckets

### AI Admin (`/api/v1/admin/ai`)

**Requires admin auth.**

#### Providers
- `GET /providers` - List providers
- `GET /providers/:id` - Get provider
- `POST /providers` - Create provider
- `PUT /providers/:id` - Update provider
- `DELETE /providers/:id` - Delete provider
- `POST /providers/:id/health` - Check provider health

#### Models
- `GET /models` - List models
- `GET /models/:id` - Get model
- `POST /models` - Create model
- `PUT /models/:id` - Update model
- `DELETE /models/:id` - Delete model
- `POST /models/:id/test` - Test model

#### Routes
- `GET /routes` - List routes
- `GET /routes/:id` - Get route
- `POST /routes` - Create route
- `PUT /routes/:id` - Update route
- `DELETE /routes/:id` - Delete route

#### Usage & Monitoring
- `GET /usage` - Get usage statistics
- `POST /usage/log` - Log usage event
- `POST /reload` - Sync config to n8n
- `GET /config/export` - Export full config

---

## Aidove Proxy

Base path: `/aidove` (only enabled if `AIDOVE_WEBHOOK_URL` is set)

OpenAI-compatible API proxy for external services.

### POST /aidove/v1/chat/completions

OpenAI-compatible chat completions.

**Request Body:** Standard OpenAI format
```json
{
  "model": "gpt-4o",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "temperature": 0.7,
  "stream": false
}
```

### GET /aidove/v1/models

List available models (OpenAI format).

### GET /aidove/health

Proxy health check.

---

## User Content APIs

Base path: `/api` (not `/api/v1`)

### Personas (`/api/personas`)

**Requires Bearer token auth.**

- `GET /personas` - List personas
- `POST /personas` - Create persona
- `PUT /personas/:id` - Update persona
- `DELETE /personas/:id` - Delete persona

### Memos (`/api/memos`)

**Requires Bearer token auth.**

- `GET /memos` - List memos
- `POST /memos` - Create memo
- `PUT /memos/:id` - Update memo
- `DELETE /memos/:id` - Delete memo

---

## OG Image Generation

Base path: `/api/v1/og`

### GET /api/v1/og

Generate Open Graph SVG image.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | string | "Blog Post" | Image title |
| `subtitle` | string | "" | Subtitle |
| `theme` | string | "dark" | Theme (dark/light) |
| `w` or `width` | number | 1200 | Width |
| `h` or `height` | number | 630 | Height |
| `bg` | string | theme-based | Background color |
| `fg` | string | theme-based | Foreground color |

**Response:** `image/svg+xml`

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 412 | Precondition Failed - ETag mismatch |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
| 502 | Bad Gateway - Upstream service error |
| 503 | Service Unavailable - Service not configured |
| 504 | Gateway Timeout - Upstream timeout |

---

## Rate Limiting

Default rate limit: 100 requests per minute per IP.

Configured via environment variables:
- `RATE_LIMIT_MAX` - Max requests per window
- `RATE_LIMIT_WINDOW_MS` - Window duration in ms

Response headers:
- `X-RateLimit-Limit` - Max requests
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset timestamp
