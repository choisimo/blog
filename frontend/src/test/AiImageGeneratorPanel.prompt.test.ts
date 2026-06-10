import { describe, expect, it } from 'vitest';

import {
  buildFinalImagePrompt,
  buildSuggestedPrompt,
  hasStateMachineDiagramIntent,
} from '@/components/features/admin/aiImagePrompt';

describe('AiImageGeneratorPanel prompt helpers', () => {
  it('adds flat raster constraints to custom prompts before generation', () => {
    const prompt = buildFinalImagePrompt(
      'Create an image about operating systems.',
      'fallback prompt',
    );

    expect(prompt).toContain('flat 2D raster image');
    expect(prompt).toContain('Do not generate 3D');
    expect(prompt).toContain('shadows');
    expect(prompt).toContain('humanoid AI agents');
  });

  it('uses state-machine raster diagram instructions for state-machine contexts', () => {
    const prompt = buildSuggestedPrompt({
      title: '프로세스 상태 머신',
      category: '기술',
      tags: 'OS, Process',
      content: '생성, 준비, 실행, 대기, 종료 상태를 오가는 상태머신 다이어그램',
    });

    expect(hasStateMachineDiagramIntent(prompt)).toBe(true);
    expect(prompt).toContain('state-machine diagram as a raster image');
    expect(prompt).toContain('labeled nodes');
    expect(prompt).not.toContain('no visible text');
  });

  it('does not duplicate constraints when using the suggested prompt', () => {
    const suggestedPrompt = buildSuggestedPrompt({
      title: '일반 기술 글',
      category: '기술',
      tags: 'Architecture',
      content: '분산 시스템 운영 회고',
    });
    const prompt = buildFinalImagePrompt('', suggestedPrompt);

    expect(prompt.match(/Required rendering constraints:/g)).toHaveLength(1);
  });
});
