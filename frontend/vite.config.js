import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { cacheRuntime } from './src/pwa/cachePolicy.js';
import { manifest } from './src/pwa/manifest.js';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest,
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        ...(cacheRuntime.length ? { runtimeCaching: cacheRuntime } : {}),
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.API_PROXY || 'http://localhost:4000',
    },
  },
  preview: {
    proxy: {
      '/api': process.env.API_PROXY || 'http://localhost:4000',
    },
  },
});
