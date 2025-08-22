import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    // Buffer logs per test; show none unless VITEST_SHOW_LOGS=true, or failed tests at end
    onConsoleLog(log, type, entity) {
      if (process.env.VITEST_SHOW_LOGS === 'true') return true;
      const g: any = globalThis as any;
      if (!g.__VITEST_LOG_STORE) {
        g.__VITEST_LOG_STORE = { logs: new Map(), meta: new Map() };
      }
      const store = g.__VITEST_LOG_STORE as any;
      const id = entity?.id || `${entity?.filepath || 'unknown'}:${entity?.name || 'unknown'}`;
      if (!store.logs.has(id)) store.logs.set(id, []);
      store.logs.get(id).push(`[${type}] ${log}`);
      if (entity) store.meta.set(id, { file: entity.filepath || 'unknown', name: entity.name || 'unknown' });
      return false;
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
    reporters: [
      'default',
      { reporter: './tests/reporters/end-summary.ts', options: {} },
      { reporter: './tests/reporters/fail-logs.ts', options: {} },
      { reporter: './tests/reporters/results-md.ts', options: {} },
    ],
  },
});


