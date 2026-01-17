import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    globals: false,
    pool: 'forks',
    testTimeout: 10000,
    hookTimeout: 10000,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      enabled: false,
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/bin/**',
        'src/components/**',
        'src/hooks/**',
        'src/index.ts',
        'src/setup/**', // Interactive setup (requires user input)
        'src/utils/prompt.ts', // Interactive prompts
        'src/utils/status.ts', // UI display helpers
        'src/utils/time.ts', // Simple formatters
      ],
      thresholds: {
        lines: 35,
        functions: 40,
        branches: 40,
        statements: 35,
      },
    },
    setupFiles: ['./tests/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
