import { defineConfig, loadEnv, mergeConfig } from 'vite';
import { nimiWebViteConfig } from '@nimiplatform/app-tools/web';
import base from './vite.config.js';
export default defineConfig(({ command, mode }) => mergeConfig(mergeConfig(base, {
  plugins: [{ name: 'overtone-web-entry', transformIndexHtml: { order: 'pre', handler: (html: string) => html.replace('/src/main.tsx', '/src/main.web.tsx') } }],
  build: { outDir: 'dist-web' },
}), nimiWebViteConfig({ root: import.meta.dirname, env: { ...loadEnv(mode, import.meta.dirname, ''), ...process.env }, serve: command === 'serve' })));
