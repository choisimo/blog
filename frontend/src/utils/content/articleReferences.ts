import type { MouseEvent } from 'react';
import type { Element, ElementContent, Root, RootContent } from 'hast';

const REFERENCE_HEADING =
  /^(출처(?:와 자료의 범위)?|참고\s*문헌|참고\s*자료|참고\s*링크|references|sources|bibliography|citations)$/i;

function textContent(node: RootContent): string {
  if (node.type === 'text') return node.value;
  return 'children' in node ? node.children.map(textContent).join('') : '';
}

/** Link only numbers backed by a bibliography; leave code and authored links intact. */
function linkNumberedCitations(
  content: RootContent[],
  bibliography: ElementContent[],
  ids: Set<unknown>
) {
  const references = new Map<string, string>();
  for (const node of bibliography) {
    if (node.type !== 'element' || node.tagName !== 'p') continue;
    const number = /^\[(\d{2})\]\s/.exec(textContent(node))?.[1];
    if (!number || references.has(number)) continue;
    const baseId = `user-content-article-ref-${number}`;
    let id = baseId;
    for (let suffix = 2; ids.has(id); suffix++) id = `${baseId}-${suffix}`;
    ids.add(id);
    references.set(number, id);
    // Paragraphs have custom renderers. An inline target retains their layout.
    node.children.splice(0, 1, {
      type: 'element',
      tagName: 'span',
      properties: { id, className: ['article-reference-target'], tabIndex: -1 },
      children: node.children.slice(0, 1),
    });
  }
  if (!references.size) return;

  const linkChildren = (node: RootContent) => {
    if (
      node.type !== 'element' ||
      /^(a|code|pre|sup|script|style|h[1-6])$/.test(node.tagName)
    )
      return;
    node.children = node.children.flatMap((child): ElementContent[] => {
      if (child.type !== 'text') {
        linkChildren(child);
        return [child];
      }
      const result: ElementContent[] = [];
      let start = 0;
      for (const match of child.value.matchAll(/\[(\d{2})\]/g)) {
        const id = references.get(match[1]);
        if (!id) continue;
        const index = match.index;
        if (index > start)
          result.push({ type: 'text', value: child.value.slice(start, index) });
        result.push({
          type: 'element',
          tagName: 'sup',
          properties: { className: ['article-citation'] },
          children: [
            {
              type: 'element',
              tagName: 'a',
              properties: { href: `#${id}` },
              children: [{ type: 'text', value: match[0] }],
            },
          ],
        });
        start = index + match[0].length;
      }
      if (start < child.value.length)
        result.push({ type: 'text', value: child.value.slice(start) });
      return result;
    });
  };
  content.forEach(linkChildren);
}

function disclosure(
  children: ElementContent[],
  english: boolean,
  label = english ? 'Reference list' : '참고 자료'
): Element {
  return {
    type: 'element',
    tagName: 'details',
    properties: { className: ['article-references'] },
    children: [
      {
        type: 'element',
        tagName: 'summary',
        properties: {},
        children: [
          { type: 'text', value: `${label} ` },
          ...(['closed', 'open'] as const).map(
            (state): Element => ({
              type: 'element',
              tagName: 'span',
              properties: { className: [`article-references__${state}`] },
              children: [
                {
                  type: 'text',
                  value: english
                    ? state === 'closed'
                      ? '— Show'
                      : '— Hide'
                    : state === 'closed'
                      ? '펼치기'
                      : '접기',
                },
              ],
            })
          ),
        ],
      },
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['article-references__body'] },
        children,
      },
    ],
  };
}

/** Runs after sanitization. Keep the source heading/IDs and all citation content. */
export function rehypeArticleReferences() {
  return (tree: Root) => {
    const elements: Element[] = [];
    const collect = (node: Root | RootContent) => {
      if (node.type === 'element') elements.push(node);
      if ('children' in node) node.children.forEach(collect);
    };
    collect(tree);
    const ids = new Set(elements.map(node => node.properties.id));
    // Sanitize prefixes footnote IDs a second time. Point only generated
    // footnote links at the existing sanitized ID; never weaken the sanitizer.
    for (const node of elements) {
      if (
        node.tagName !== 'a' ||
        !(
          'dataFootnoteRef' in node.properties ||
          'dataFootnoteBackref' in node.properties
        )
      )
        continue;
      const href = node.properties.href;
      if (typeof href !== 'string' || !href.startsWith('#')) continue;
      let id: string;
      try {
        id = decodeURIComponent(href.slice(1));
      } catch {
        continue;
      }
      if (!ids.has(id) && ids.has(`user-content-${id}`)) {
        node.properties.href = `#${encodeURIComponent(`user-content-${id}`)}`;
      }
    }
    // GFM footnotes are their own trailing section. Keep their backlinks and IDs.
    for (const node of tree.children) {
      if (
        node.type !== 'element' ||
        node.tagName !== 'section' ||
        !('dataFootnotes' in node.properties)
      )
        continue;
      const firstReference = node.children.findIndex(
        child => child.type === 'element' && child.tagName === 'ol'
      );
      if (firstReference < 0) continue;
      const heading = node.children.find(
        child => child.type === 'element' && child.tagName === 'h2'
      );
      const panel = disclosure(
        node.children.slice(firstReference),
        true,
        heading ? textContent(heading) : 'Footnotes'
      );
      if (heading?.type === 'element') {
        const summary = panel.children[0] as Element;
        summary.properties.id = heading.properties.id;
      }
      node.children = [panel];
    }

    // Only fold a final, explicitly named bibliography, not similarly named prose
    // or a section followed by further article headings.
    for (let index = tree.children.length - 1; index >= 0; index--) {
      const heading = tree.children[index];
      if (heading.type !== 'element' || !/^h[1-6]$/.test(heading.tagName))
        continue;
      const title = textContent(heading).trim();
      if (!REFERENCE_HEADING.test(title)) return;
      const following = tree.children.slice(index + 1);
      const footnotesIndex = following.findIndex(
        node =>
          node.type === 'element' &&
          node.tagName === 'section' &&
          'dataFootnotes' in node.properties
      );
      const body = (
        footnotesIndex < 0 ? following : following.slice(0, footnotesIndex)
      ).filter((node): node is ElementContent => node.type !== 'doctype');
      if (
        !body.some(node => node.type === 'element') ||
        body.some(node => node.type === 'element' && node.tagName === 'details')
      )
        return;
      linkNumberedCitations(tree.children.slice(0, index), body, ids);
      tree.children.splice(
        index + 1,
        footnotesIndex < 0 ? following.length : footnotesIndex,
        disclosure(body, /^[a-z]/i.test(title))
      );
      return;
    }
  };
}

export function handleArticleCitationClick(
  event: MouseEvent<HTMLAnchorElement>
) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !event.currentTarget.closest('sup.article-citation')
  )
    return;
  const href = event.currentTarget.getAttribute('href');
  if (!href?.startsWith('#')) return;
  const target = document.getElementById(href.slice(1));
  const panel = target?.closest<HTMLDetailsElement>(
    'details.article-references'
  );
  if (!target || !panel) return;

  event.preventDefault();
  panel.open = true;
  if (window.location.hash !== href) {
    window.history.pushState(window.history.state, '', href);
  }
  target.focus({ preventScroll: true });
  target.scrollIntoView({
    block: 'center',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'instant'
      : 'smooth',
  });
}
