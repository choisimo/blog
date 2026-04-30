/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import crypto from 'node:crypto';
import path from 'path';
import { componentTagger } from 'lovable-tagger';
import { visualizer } from 'rollup-plugin-visualizer';

const GATEWAY_SIGNATURE_VERSION = 'v1';

function buildGatewaySignatureHeaders(input: {
  method: string | undefined;
  pathAndQuery: string | undefined;
  secret: string;
}): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const requestId = crypto.randomUUID();
  const payload = [
    GATEWAY_SIGNATURE_VERSION,
    timestamp,
    String(input.method || 'GET').toUpperCase(),
    input.pathAndQuery || '/',
    requestId,
  ].join('\n');
  const signature = `${GATEWAY_SIGNATURE_VERSION}:${crypto
    .createHmac('sha256', input.secret)
    .update(payload)
    .digest('hex')}`;

  return {
    'X-Gateway-Signature-Version': GATEWAY_SIGNATURE_VERSION,
    'X-Gateway-Timestamp': timestamp,
    'X-Gateway-Request-ID': requestId,
    'X-Gateway-Signature': signature,
    'X-Origin-Verified-By': 'vite-dev-proxy',
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..', '..'), '');
  const devHost = env.VITE_DEV_HOST || '::';
  const devPort = Number(env.VITE_DEV_PORT || 8080);
  const strictPort =
    env.VITE_DEV_STRICT_PORT === 'true' || env.VITE_DEV_STRICT_PORT === '1';
  const backendProxyTarget = env.VITE_BACKEND_PROXY_TARGET;
  const backendProxySigningSecret = (
    env.BACKEND_PROXY_SIGNING_SECRET ||
    env.BACKEND_GATEWAY_SIGNING_SECRET ||
    env.GATEWAY_SIGNING_SECRET ||
    ''
  ).trim();
  const backendProxyBackendKey = (
    env.BACKEND_PROXY_BACKEND_KEY ||
    env.BACKEND_KEY ||
    ''
  ).trim();
  const preserveSymlinks = mode !== 'test';
  return {
    css: {
      postcss: path.resolve(__dirname, './postcss.config.js'),
    },
    // Explicit base for clarity on GH Pages/custom domain
    base: '/',
    publicDir: 'public',
    // Load .env from repo root so a single .env controls all
    envDir: path.resolve(__dirname, '..', '..'),
    server: {
      host: devHost,
      port: devPort,
      strictPort,
      proxy: backendProxyTarget
        ? {
            '/api': {
              target: backendProxyTarget,
              changeOrigin: true,
              secure: false,
              configure(proxy) {
                if (!backendProxySigningSecret && !backendProxyBackendKey) return;

                proxy.on('proxyReq', (proxyReq, req) => {
                  proxyReq.removeHeader('origin');

                  const headers = {
                    ...(backendProxySigningSecret
                      ? buildGatewaySignatureHeaders({
                          method: req.method,
                          pathAndQuery: req.url,
                          secret: backendProxySigningSecret,
                        })
                      : {}),
                    ...(backendProxyBackendKey
                      ? { 'X-Backend-Key': backendProxyBackendKey }
                      : {}),
                  };

                  for (const [name, value] of Object.entries(headers)) {
                    proxyReq.setHeader(name, value);
                  }
                });
              },
            },
          }
        : undefined,
    },
    optimizeDeps: {
      include: ['buffer'],
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      copyPublicDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: [
              'lucide-react',
              '@radix-ui/react-slot',
              '@radix-ui/react-toast',
              '@radix-ui/react-tooltip',
            ],
            markdown: [
              'react-markdown',
              'react-syntax-highlighter',
              'remark-gfm',
              'remark-frontmatter',
            ],
            utils: ['clsx', 'class-variance-authority', 'tailwind-merge'],
            search: ['fuse.js'],
          },
        },
      },
      assetsDir: 'assets',
      chunkSizeWarningLimit: 600,
      sourcemap: mode === 'development',
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
      mode === 'production' &&
        visualizer({
          filename: 'dist/stats.html',
          open: false,
          gzipSize: true,
          brotliSize: true,
        }),
    ].filter(Boolean),
    resolve: {
      preserveSymlinks,
      alias: {
        '@': path.resolve(__dirname, '../src'),
        buffer: 'buffer',
        zod: path.resolve(__dirname, '../node_modules/zod/index.js'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: [path.resolve(__dirname, '../src/test/setup.ts')],
      css: true,
      exclude: [...configDefaults.exclude, 'e2e/**'],
    },
  };
});
