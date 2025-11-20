/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..', '..'), '');
  const devHost = env.VITE_DEV_HOST || '::';
  const devPort = Number(env.VITE_DEV_PORT || 8080);
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
            '@radix-ui/react-accordion',
            '@radix-ui/react-avatar',
            '@radix-ui/react-dialog',
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
    alias: {
      '@': path.resolve(__dirname, '../src'),
      buffer: 'buffer',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, '../src/test/setup.ts')],
    css: true,
  },
};
});
