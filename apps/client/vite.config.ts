import { defineConfig } from 'vite';
import { tanstackRouter } from '@tanstack/router-vite-plugin';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  plugins: [
    nxViteTsPaths(),
    tanstackRouter({
      routesDirectory: './frontend/routes',
      generatedRouteTree: './frontend/routeTree.gen.ts',
    }),
    react(),
  ],
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
