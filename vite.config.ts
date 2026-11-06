import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

function apiPlugin(): Plugin {
  return {
    name: 'development-api',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/' || req.url?.startsWith('/?')) req.url = '/index.source.html';
        next();
      });
      // Reuse the production security, CORS and validation in development too.
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        process.env.VITE_DEV = 'true';
        const { default: app } = await import('./server.ts');
        app(req as any, res as any, next);
      });
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    build: { rollupOptions: { input: path.resolve(import.meta.dirname, 'index.source.html') } },
    plugins: [react(), tailwindcss(), apiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
