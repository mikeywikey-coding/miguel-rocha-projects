import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/ui', use: { baseURL: 'http://127.0.0.1:4173', channel: 'msedge', viewport: { width: 1487, height: 1058 } }, workers: 1, reporter: 'list' });
