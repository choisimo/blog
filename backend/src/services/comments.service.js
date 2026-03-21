const listenersByPost = new Map();

export function normalizeEmoji(v) {
  return String(v || '').trim().slice(0, 8);
}

export function normalizeFingerprint(v) {
  return String(v || '').trim().slice(0, 128);
}

export function normalizeCommentId(v) {
  return String(v || '').trim().slice(0, 128);
}

export function normalizePostId(v) {
  return String(v || '').trim().slice(0, 256);
}

export function addSSEListener(postId, send) {
  const key = String(postId);
  let set = listenersByPost.get(key);
  if (!set) {
    set = new Set();
    listenersByPost.set(key, set);
  }
  set.add(send);
  return () => {
    try {
      set.delete(send);
      if (set.size === 0) listenersByPost.delete(key);
    } catch {}
  };
}

export function broadcastToPost(postId, payload) {
  const key = String(postId);
  const set = listenersByPost.get(key);
  if (!set || set.size === 0) return;
  for (const send of Array.from(set)) {
    try {
      send(payload);
    } catch {
      try {
        set.delete(send);
      } catch {}
    }
  }
}

export function formatCommentForResponse(d) {
  return {
    id: d.id,
    postId: d.post_id,
    author: d.author,
    content: d.content,
    website: null,
    parentId: null,
    createdAt: d.created_at,
  };
}

export function validateComment(data) {
  const errors = [];
  
  const { author, content, postId, postSlug, slug } = data;
  const postIdentifier = postId || postSlug || slug;
  
  if (!postIdentifier || typeof postIdentifier !== 'string') {
    errors.push('postId, postSlug, or slug is required');
  }
  if (!author || typeof author !== 'string') {
    errors.push('author is required');
  }
  if (!content || typeof content !== 'string') {
    errors.push('content is required');
  }
  if (author && author.length > 64) {
    errors.push('Author name too long (max 64 characters)');
  }
  if (content && content.length > 5000) {
    errors.push('Content too long (max 5000 characters)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    normalizedPostId: postIdentifier ? normalizePostId(postIdentifier) : null,
    normalizedAuthor: author ? author.trim().slice(0, 64) : null,
    normalizedContent: content ? content.trim().slice(0, 5000) : null,
  };
}

export function createSSEHeaders() {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}

export function formatSSEMessage(data) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  const lines = String(payload).split(/\n/);
  let result = '';
  for (const line of lines) {
    result += `data: ${line}\n`;
  }
  result += '\n';
  return result;
}
