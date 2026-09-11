export type ScrollVisibility = {
  y: number;
  distance: number;
  hidden: boolean;
};

/** Accumulate even slow movement; asymmetric thresholds avoid flicker on reversal. */
export function nextScrollVisibility(
  previous: ScrollVisibility,
  rawY: number,
  maxScroll: number,
  revealAtBottom = false
): ScrollVisibility {
  const y = Math.max(0, Math.min(rawY, Math.max(0, maxScroll)));
  if (y < 80 || (revealAtBottom && y >= maxScroll - 100)) {
    return { y, distance: 0, hidden: false };
  }
  const delta = y - previous.y;
  if (delta === 0) return previous;
  const distance =
    Math.sign(delta) === Math.sign(previous.distance)
      ? previous.distance + delta
      : delta;
  if (distance >= 48) return { y, distance: 0, hidden: true };
  if (distance <= -20) return { y, distance: 0, hidden: false };
  return { y, distance, hidden: previous.hidden };
}
