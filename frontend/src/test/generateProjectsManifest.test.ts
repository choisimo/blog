import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const generator = path.resolve('scripts/generate-projects-manifest.js');
let workspace: string;

function generate() {
  execFileSync(process.execPath, [generator], { cwd: workspace });
  return JSON.parse(
    readFileSync(path.join(workspace, 'public/projects-manifest.json'), 'utf8')
  );
}

describe('project manifest deletion persistence', () => {
  beforeEach(() => {
    workspace = mkdtempSync(path.join(tmpdir(), 'project-manifest-'));
    mkdirSync(path.join(workspace, 'public'));
    mkdirSync(path.join(workspace, 'scripts'));
    writeFileSync(
      path.join(workspace, 'public/project-catalog.json'),
      JSON.stringify({
        repositories: [
          {
            repository: 'choisimo/retired',
            url: 'https://github.com/choisimo/retired',
          },
        ],
      })
    );
    writeFileSync(
      path.join(workspace, 'scripts/project-catalog-summaries.json'),
      JSON.stringify({
        retired: { description: 'Retired project', category: 'Web' },
      })
    );
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it('keeps a missing content directory empty despite an available catalog', () => {
    expect(generate()).toMatchObject({ total: 0, items: [] });
    expect(generate()).toMatchObject({ total: 0, items: [] });
    expect(readdirSync(path.join(workspace, 'public'))).not.toContain(
      'project-data'
    );
  });

  it('removes the last deleted project from the manifest without recreating it', () => {
    const directory = path.join(workspace, 'public/project-data');
    mkdirSync(directory);
    const source = path.join(directory, 'retired.md');
    writeFileSync(
      source,
      '---\ntitle: Retired\nurl: https://example.com\n---\nRetired project\n'
    );
    expect(generate().total).toBe(1);
    rmSync(source);
    expect(generate()).toMatchObject({ total: 0, items: [] });
    expect(readdirSync(directory)).toEqual([]);
  });

  it('allows all remaining Markdown entries to be unpublished', () => {
    const directory = path.join(workspace, 'public/project-data');
    mkdirSync(directory);
    writeFileSync(
      path.join(directory, 'draft.md'),
      '---\ntitle: Draft\nurl: https://example.com\npublished: false\n---\nDraft\n'
    );
    expect(generate()).toMatchObject({ total: 0, items: [] });
    expect(readdirSync(directory)).toEqual(['draft.md']);
  });
});
