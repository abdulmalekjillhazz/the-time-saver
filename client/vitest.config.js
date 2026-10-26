import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    alias: {
      'react/jsx-dev-runtime': require.resolve('react/jsx-dev-runtime'),
      'react/jsx-runtime': require.resolve('react/jsx-runtime'),
      react: require.resolve('react'),
    },
  },
  test: {
    include: ['tests/**/*.test.js'],
    server: {
      deps: {
        inline: ['zustand'],
      },
    },
  },
});
