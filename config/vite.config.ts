/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  css: {
    postcss: path.resolve(__dirname, './postcss.config.js'),
  },
  // Explicit base for clarity on GH Pages/custom domain
  base: '/',
  publicDir: 'public',
  server: {
    host: '::',
    port: 8080,
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
    setupFiles: ['src/test/setup.ts'],
    css: true,
  },
}));
