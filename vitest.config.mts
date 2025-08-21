import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    // Reduce noisy logs interleaved in output; keep summary readable
    onConsoleLog(log) {
      if (/^\[dotenv@/.test(log)) return false;
      if (/^\[cleanup\]/.test(log)) return false;
      if (/GPT API error:/i.test(log)) return false;
      return true;
    },
    setupFiles: ['tests/config/env.ts'],
    globalSetup: 'tests/config/globalSetup.ts',
    include: ['tests/**/*.{e2e,int,unit}.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,

    sequence: { concurrent: false },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        'tests/**',
        'src/**/*.d.ts',
        'src/index.ts',
        'src/db/config/migrations/**',
        'src/db/config/seeds/**',
      ],
      all: true,
    },
  },
});


