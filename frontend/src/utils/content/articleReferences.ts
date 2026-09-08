import type { Element, ElementContent, Root, RootContent } from 'hast';

const REFERENCE_HEADING =
  /^(출처|참고\s*문헌|참고\s*자료|참고\s*링크|references|sources|bibliography|citations)$/i;

function textContent(node: RootContent): string {
  if (node.type === 'text') return node.value;
  return 'children' in node ? node.children.map(textContent).join('') : '';
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
      tree.children.splice(
        index + 1,
        footnotesIndex < 0 ? following.length : footnotesIndex,
        disclosure(body, /^[a-z]/i.test(title))
      );
      return;
    }
  };
}
