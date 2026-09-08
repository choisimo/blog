import { memo, useId, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  GitBranch,
  Layers3,
  Route,
} from 'lucide-react';
import type { ArticleDiagramData } from './articleDiagram';
import './article-diagram.css';

const kinds = {
  flow: { label: '처리 흐름', icon: Route },
  structure: { label: '구성 관계', icon: GitBranch },
  compare: { label: '항목 비교', icon: Layers3 },
};

/** Authored data only: content cannot inject HTML, CSS or executable JavaScript. */
export const ArticleDiagram = memo(function ArticleDiagram({
  data,
}: {
  data: ArticleDiagramData;
}) {
  const titleId = useId();
  const [selected, setSelected] = useState(0);
  const current = data.nodes[selected] ?? data.nodes[0];
  const { label, icon: Icon } = kinds[data.kind];
  const connections = data.edges.filter(
    edge => edge.from === current.id || edge.to === current.id
  );
  const related = new Set(connections.flatMap(edge => [edge.from, edge.to]));
  const labelFor = (id: string) =>
    data.nodes.find(node => node.id === id)?.label ?? id;

  return (
    <figure
      className='article-diagram not-prose'
      data-kind={data.kind}
      aria-labelledby={titleId}
    >
      <figcaption className='article-diagram__heading'>
        <div className='article-diagram__eyebrow'>
          <Icon size={16} aria-hidden='true' />
          {label}
          <span>{String(data.nodes.length).padStart(2, '0')}개 항목</span>
        </div>
        <h3 id={titleId}>{data.title}</h3>
        {data.caption && <p>{data.caption}</p>}
      </figcaption>
      <ol className='article-diagram__nodes no-terminal-style' aria-label={data.title}>
        {data.nodes.map((node, index) => (
          <li
            key={node.id}
            className='article-diagram__node'
            data-selected={node.id === current.id}
            data-related={related.has(node.id)}
            data-connected-next={
              data.kind === 'flow' &&
              data.edges.some(
                edge =>
                  edge.from === node.id && edge.to === data.nodes[index + 1]?.id
              )
            }
          >
            <button
              type='button'
              className='article-diagram__select'
              aria-pressed={node.id === current.id}
              onClick={() => setSelected(index)}
            >
              <span className='article-diagram__number' aria-hidden='true'>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>{node.label}</span>
              {data.kind === 'flow' && (
                <ArrowDown
                  className='article-diagram__direction'
                  size={18}
                  aria-hidden='true'
                />
              )}
            </button>
            <div className='article-diagram__body'>
              {node.detail && <p>{node.detail}</p>}
              {node.items && (
                <ul className='no-terminal-style'>
                  {node.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              )}
              {data.edges.some(edge => edge.from === node.id) && (
                <div className='article-diagram__outgoing'>
                  {data.edges
                    .filter(edge => edge.from === node.id)
                    .map((edge, edgeIndex) => (
                      <span key={edgeIndex}>
                        <ArrowRight size={13} aria-hidden='true' />
                        <span>
                          {edge.label ? `${edge.label} · ` : ''}
                          {labelFor(edge.to)}
                        </span>
                      </span>
                    ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className='article-diagram__navigator'>
        <div
          className='article-diagram__selection'
          aria-live='polite'
          aria-atomic='true'
        >
          <span className='article-diagram__position'>
            {selected + 1} / {data.nodes.length}
          </span>
          <strong>{current.label}</strong>
          <span>
            {connections.length
              ? `연결 ${connections.length}개 강조됨`
              : '선택한 항목'}
          </span>
        </div>
        <div className='article-diagram__controls' aria-label='도식 항목 탐색'>
          <button
            type='button'
            aria-label='이전 항목'
            disabled={selected === 0}
            onClick={() => setSelected(value => value - 1)}
          >
            <ArrowLeft size={18} aria-hidden='true' />
          </button>
          <button
            type='button'
            aria-label='다음 항목'
            disabled={selected === data.nodes.length - 1}
            onClick={() => setSelected(value => value + 1)}
          >
            <ArrowRight size={18} aria-hidden='true' />
          </button>
        </div>
      </div>
    </figure>
  );
});
