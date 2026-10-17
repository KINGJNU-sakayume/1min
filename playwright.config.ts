import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// 이 개발 환경(클라우드 컨테이너)에는 Chromium만 미리 설치되어 있다. CI는 WebKit도 설치해 돌린다.
const localChromium = '/opt/pw-browsers/chromium';
const chromiumLaunch = existsSync(localChromium) ? { executablePath: localChromium } : {};
const withWebkit = process.env.PW_WEBKIT === '1';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/1min/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/1min/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'iphone-chromium',
      use: { ...devices['iPhone 13'], browserName: 'chromium', launchOptions: chromiumLaunch },
    },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: chromiumLaunch },
    },
    ...(withWebkit ? [{ name: 'iphone-webkit', use: { ...devices['iPhone 13'] } }] : []),
  ],
});
