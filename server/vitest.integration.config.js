import { defineConfig } from 'vitest/config';

// Tests against a real MongoDB (MONGODB_URI_TEST). CI starts one as a service container.
// globalSetup refuses to run without a test database, and refuses a database whose name lacks "test".
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.js'],
    globalSetup: ['tests/integration/guard.js'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
