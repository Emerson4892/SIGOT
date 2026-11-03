import { defineConfig, devices } from '@playwright/test';
import { cargarEntorno } from './tests/e2e/entorno.js';

const entorno = cargarEntorno();
const api = 'http://127.0.0.1:4010';
const web = 'http://127.0.0.1:5174';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.js/,
  timeout: 240000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/e2e/global-setup.js',
  use: {
    baseURL: web,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node src/server.js',
      cwd: '../backend',
      url: `${api}/api/salud`,
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        ...entorno,
        NODE_ENV: 'test',
        PORT: '4010',
        DATABASE_URL: entorno.TEST_DATABASE_URL,
        COOKIE_SECURE: 'false',
        SEED_DEMO_USERS: 'true',
        LOG_LEVEL: 'silent',
        CORS_ORIGIN: web,
        APP_URL: web,
      },
    },
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5174 --strictPort',
      url: web,
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        API_PROXY: api,
      },
    },
  ],
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
});
