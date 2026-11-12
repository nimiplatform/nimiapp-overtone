import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.js';
import { mobileAccess } from './capacitor.config';

export default defineConfig(mergeConfig(base, {
  plugins: [{
    name: 'overtone-mobile-entry',
    transformIndexHtml: { order: 'pre', handler: (html: string) => html.replace('/src/main.tsx', '/src/main.mobile.tsx') },
  }],
  define: { __NIMI_APP_MOBILE_CONFIG__: JSON.stringify(mobileAccess) },
  build: { outDir: 'dist-mobile' },
}));
