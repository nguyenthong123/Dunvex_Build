import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});

// Separate config for React component tests (jsdom)
export const browserConfig = defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.integration.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
