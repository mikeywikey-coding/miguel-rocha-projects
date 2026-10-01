import { defineConfig } from "@playwright/test";

const PORT = 4173;

// Uses Playwright's bundled Chromium by default. Set PLAYWRIGHT_CHANNEL (e.g. "msedge")
// to test an installed browser, or CHROMIUM_PATH to point at a specific binary.
export default defineConfig({
  testDir: "./tests/ui",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
    viewport: { width: 1487, height: 1058 },
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
