import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      react: path.join(clientRoot, 'node_modules', 'react', 'index.js'),
      'react/jsx-runtime': path.join(clientRoot, 'node_modules', 'react', 'jsx-runtime.js'),
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
