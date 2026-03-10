import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const simulatorsDir = path.resolve(__dirname, '../../public/posts/2025');

function extractInlineScripts(html: string): string[] {
  return Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/gi), (match) =>
    match[1]?.trim() ?? ''
  ).filter(Boolean);
}

describe('algorithm simulator html', () => {
  it(
    'keeps every simulator inline script syntactically valid',
    () => {
      const files = fs
        .readdirSync(simulatorsDir)
        .filter((file) => file.endsWith('-simulator.html'))
        .sort();

      const failures: string[] = [];

      for (const file of files) {
        const html = fs.readFileSync(path.join(simulatorsDir, file), 'utf8');
        const scripts = extractInlineScripts(html);

        if (scripts.length === 0) {
          failures.push(`${file}: no inline script found`);
          continue;
        }

        scripts.forEach((script, index) => {
          try {
            new vm.Script(script, { filename: `${file}#script-${index + 1}` });
          } catch (error) {
            failures.push(
              `${file}#script-${index + 1}: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        });

        if (!html.includes('render();')) {
          failures.push(`${file}: missing render() bootstrap`);
        }
      }

      expect(failures).toEqual([]);
    }
  );
});
