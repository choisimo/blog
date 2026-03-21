import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..', '..');

export function resolveSiteBaseUrl() {
  dotenv.config({ path: path.join(repoRoot, '.env') });
  dotenv.config({ path: path.join(repoRoot, '.env.local') });
  dotenv.config({ path: path.join(repoRoot, 'frontend', '.env'), override: true });
  dotenv.config({ path: path.join(repoRoot, 'frontend', '.env.local'), override: true });

  return (
    process.env.SITE_BASE_URL ||
    process.env.VITE_SITE_BASE_URL ||
    'https://noblog.nodove.com'
  );
}
