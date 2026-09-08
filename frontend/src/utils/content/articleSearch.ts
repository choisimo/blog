/** Search rendered prose without rewriting React-owned nodes or matching tool labels. */
export function findArticleRanges(root: HTMLElement, query: string, limit = 1000): { ranges: Range[]; limited: boolean } {
  const needle = query.trim();
  if (!needle) return { ranges: [], limited: false };
  const expression = new RegExp(needle.split(/\s+/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'giu');
  const groups: Text[][] = [];
  let currentBlock: Element | null = null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      return parent && !parent.closest('button,summary,input,textarea,select,script,style,[hidden],[aria-hidden="true"],.linenumber,.react-syntax-highlighter-line-number,.sentio-trigger,.sentio-panel,.article-print-source,.article-code-toolbar,.article-table-toolbar')
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const block = node.parentElement?.closest('p,h1,h2,h3,h4,h5,h6,li,td,th,pre,.article-code-highlighter') || root;
    // A nested list interrupts its parent's text. Do not concatenate text across it.
    if (block !== currentBlock) {
      groups.push([]);
      currentBlock = block;
    }
    groups[groups.length - 1].push(node as Text);
  }
  const ranges: Range[] = [];
  for (const nodes of groups) {
    const text = nodes.map(part => part.data).join('');
    expression.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = expression.exec(text))) {
      if (ranges.length >= limit) return { ranges, limited: true };
      const start = match.index, end = start + match[0].length;
      const range = document.createRange();
      let offset = 0;
      for (const part of nodes) {
        const next = offset + part.length;
        if (start >= offset && start < next) range.setStart(part, start - offset);
        if (end > offset && end <= next) { range.setEnd(part, end - offset); break; }
        offset = next;
      }
      ranges.push(range);
    }
  }
  return { ranges, limited: false };
}
