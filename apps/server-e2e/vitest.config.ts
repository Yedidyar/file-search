import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.spec.ts'],
    globals: true,
    root: './',
    setupFiles: ['./src/test-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  plugins: [swc.vite()],
});
