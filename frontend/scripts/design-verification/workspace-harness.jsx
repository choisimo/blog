// Test-only entry: render the real workspace components without production routing
// or authentication. The Playwright runner blocks API and external requests.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../src/contexts/ThemeContext';
import { LanguageProvider } from '../../src/contexts/LanguageContext';
import { TooltipProvider } from '../../src/components/ui/tooltip';
import { AdminDashboard } from '../../src/pages/admin/AdminDashboard';
import NewPost from '../../src/pages/admin/NewPost';
import '../../src/index.css';
import '../../src/styles/fieldnotes-foundation.css';
import '../../src/styles/fieldnotes-theme.css';
import '../../src/styles/fieldnotes-shell.css';
import '../../src/styles/fieldnotes-public.css';
import '../../src/styles/fieldnotes-reader.css';
import '../../src/styles/fieldnotes-workspaces.css';
import '../../src/styles/fieldnotes-overlays.css';

const parameters = new URLSearchParams(window.location.search);
const standalone = parameters.get('surface') === 'standalone';
const section = parameters.get('section');
const verificationRoutes = ['logs', 'content/editor', 'ai/prompts', 'health', 'rag', 'analytics', 'config', 'secrets/overview', 'secrets/secrets', 'secrets/audit', 'workers/workers', 'workers/secrets', 'workers/resources', 'content/home-cta', 'ai/playground', 'ai/models', 'ai/providers', 'ai/routes', 'ai/monitoring', 'ai/traces'];
const requestedRoute = parameters.get('route');
const verificationRoute = verificationRoutes.includes(requestedRoute) ? requestedRoute : null;
const initialPath = verificationRoute ? `/admin/config/${verificationRoute}`
  : section === 'prompts' ? '/admin/config/ai/prompts'
  : section === 'logs' ? '/admin/config/logs'
  : standalone ? '/admin/new-post' : '/admin/config/content/editor';
// No session or token provider is replaced. The runner blocks external network.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
const root = document.getElementById('root');

if (!root) throw new Error('Verification root missing');

createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <ThemeProvider>
        <TooltipProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route path="/admin/new-post" element={<NewPost />} />
              <Route path="/admin/config/:section/:subtab?" element={<AdminDashboard userEmail="" onLogout={() => undefined} />} />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </ThemeProvider>
    </LanguageProvider>
  </QueryClientProvider>,
);
