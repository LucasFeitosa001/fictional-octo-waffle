import { defineConfig, devices } from '@playwright/test';
import { CLUB_URL } from './tests/constants';

/**
 * Salonpass (feminino) end-to-end suite — REAL stack, NO mocks.
 *
 * These tests run READ-ONLY against the LIVE production club
 * (studioborboletas.salonpass.com.br) and its same-origin public API. No
 * `webServer` is booted and no prod data is ever mutated: the suite only
 * GETs public booking data and renders the public SPA. This keeps the suite
 * deterministic and safe to run from any machine without the full local stack.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: CLUB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
});
