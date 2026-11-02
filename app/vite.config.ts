import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const pluginEntry = (name: string) => fileURLToPath(new URL(`./node_modules/${name}/dist-js/index.js`, import.meta.url));

const host = process.env.TAURI_DEV_HOST;

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@tauri-apps/plugin-fs': pluginEntry('@tauri-apps/plugin-fs'),
      '@tauri-apps/plugin-dialog': pluginEntry('@tauri-apps/plugin-dialog'),
    },
  },
  clearScreen: false,
  // Required for Tauri production builds — without this the WebView shows a blank screen.
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    proxy: {
      '/api': { target: 'http://localhost:3847', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3847', ws: true },
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2020',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
