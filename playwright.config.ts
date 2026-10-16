import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true,
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: { command: 'npm run dev -- --hostname 127.0.0.1 --port 3100', env: { SYNCHRO_TEST_BUILD: '1', APP_URL: 'http://localhost:3100', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', CALENDAR_TOKEN_ENCRYPTION_KEY: '' }, url: 'http://localhost:3100', reuseExistingServer: false },
});
