import { defineConfig } from 'vite';
import { tanstackRouter } from '@tanstack/router-vite-plugin';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import path from 'path';

export default defineConfig({
  root: __dirname,
  plugins: [
    nxViteTsPaths(),
    tanstackRouter({
      routesDirectory: path.join(__dirname, 'frontend/routes'),
      generatedRouteTree: path.join(__dirname, 'frontend/routeTree.gen.ts'),
    }),
    react(),
  ],
  build: {
    outDir: path.join(__dirname, '../../dist/apps/client'),
    emptyOutDir: true,
  },
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  css: {
    postcss: './postcss.config.js',
  },
});
