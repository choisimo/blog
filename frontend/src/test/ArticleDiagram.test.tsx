import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ArticleDiagram } from '@/components/features/blog/visualization/ArticleDiagram';
import { parseArticleDiagram } from '@/components/features/blog/visualization/articleDiagram';

const postRoot = resolve(process.cwd(), 'public/posts');
const source = readFileSync(
  resolve(postRoot, '2024/multimodal-recommendation-system-research.md'),
  'utf8'
);
const examples = [...source.matchAll(/^```diagram\n([\s\S]*?)^```/gm)].map(
  match => parseArticleDiagram(match[1])!
);
const workflow = examples.find(
  example => example.title === '추천 엔진 처리 흐름'
)!;

describe('authored article diagrams', () => {
  it('preserves all five stages and fifteen workflow details before interaction', () => {
    render(<ArticleDiagram data={workflow} />);
    const figure = screen.getByRole('figure', { name: workflow.title });
    for (const node of workflow.nodes) {
      expect(
        within(figure).getByRole('button', { name: node.label })
      ).toBeInTheDocument();
      for (const item of node.items ?? [])
        expect(within(figure).getByText(item)).toBeInTheDocument();
    }
    expect(figure).toHaveTextContent('반응 재수집 · 데이터 수집');
    expect(
      within(figure).getByRole('button', { name: '이전 항목' })
    ).toBeDisabled();
    for (let i = 1; i < workflow.nodes.length; i++)
      fireEvent.click(
        within(figure).getByRole('button', { name: '다음 항목' })
      );
    expect(
      within(figure).getByRole('button', { name: '피드백 루프' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(figure).getByRole('button', { name: '다음 항목' })
    ).toBeDisabled();
    expect(figure.querySelector('[aria-live]')).toHaveTextContent('5 / 5');
    fireEvent.click(within(figure).getByRole('button', { name: '특징 공학' }));
    expect(figure.querySelector('[aria-live]')).toHaveTextContent('2 / 5');
  });

  it('validates every authored diagram against the production parser', () => {
    let count = 0;
    for (const year of readdirSync(postRoot).filter(value =>
      /^\d{4}$/.test(value)
    )) {
      for (const file of readdirSync(resolve(postRoot, year)).filter(value =>
        value.endsWith('.md')
      )) {
        const text = readFileSync(resolve(postRoot, year, file), 'utf8');
        for (const match of text.matchAll(/^```diagram\n([\s\S]*?)^```/gm)) {
          expect(
            parseArticleDiagram(match[1]),
            `${year}/${file}`
          ).not.toBeNull();
          count++;
        }
      }
    }
    expect(count).toBeGreaterThanOrEqual(27);
  });

  it('rejects invalid data, duplicate IDs and dangling edges without throwing', () => {
    for (const value of [
      '{',
      '{}',
      JSON.stringify({
        ...workflow,
        nodes: [workflow.nodes[0], workflow.nodes[0]],
      }),
      JSON.stringify({
        ...workflow,
        edges: [{ from: 'missing', to: workflow.nodes[0].id }],
      }),
      ' '.repeat(100001),
    ]) {
      expect(parseArticleDiagram(value)).toBeNull();
    }
  });

  it('renders author content as text, never executable markup', () => {
    const label = '<img src=x onerror=alert(1)>';
    const { container } = render(
      <ArticleDiagram
        data={{
          title: 'Literal text',
          kind: 'compare',
          nodes: [{ id: 'one', label }],
          edges: [],
        }}
      />
    );
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
});
