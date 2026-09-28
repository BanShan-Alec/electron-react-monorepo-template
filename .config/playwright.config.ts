import path from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E Configuration for Electron
 * Placed in .config/ for clean repository root structure.
 */
export default defineConfig({
  testDir: path.resolve(process.cwd(), 'e2e'),
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1, // Electron E2E must run sequentially to avoid display/process lock conflicts
  reporter: [
    ['list'],
    ['html', { outputFolder: path.resolve(process.cwd(), 'playwright-report'), open: 'never' }],
  ],
  outputDir: path.resolve(process.cwd(), 'test-results'),
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
