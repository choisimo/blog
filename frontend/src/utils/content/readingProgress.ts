/** Percentage between the article start and the last viewport of article content. */
export function calculateReadingProgress(scrollY: number, top: number, height: number, viewportHeight: number, topOffset = 0): number {
    if (![scrollY, top, height, viewportHeight, topOffset].every(Number.isFinite))
        return 0;
    if (height <= 0 || viewportHeight <= 0)
        return 0;
    const start = Math.max(0, top - topOffset);
    const end = top + height - viewportHeight;
    if (end <= start)
        return scrollY + viewportHeight >= top + height ? 100 : 0;
    return Math.max(0, Math.min(100, ((scrollY - start) / (end - start)) * 100));
}
