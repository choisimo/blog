export interface EditorReviewSnapshot {
  title: string; slug: string; year: string; category: string; tags: string;
  coverImage: string; content: string; published?: boolean;
}

/** Timestamps are intentionally excluded: only content and publishing intent invalidate review. */
export function editorReviewSignature(snapshot: EditorReviewSnapshot): string {
  return JSON.stringify([
    snapshot.title, snapshot.slug, snapshot.year, snapshot.category, snapshot.tags,
    snapshot.coverImage, snapshot.content, snapshot.published ?? null,
  ]);
}

export function isEditorReviewCurrent(signature: string, current: EditorReviewSnapshot): boolean {
  return signature === editorReviewSignature(current);
}
