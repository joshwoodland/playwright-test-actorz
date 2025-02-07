import { defineConfig } from '@playwright/test';
export default defineConfig({
    timeout: 180000,
    retries: 1,
    testDir: './tests',
    testMatch: '*.test.ts',
    use: {
        headless: true,
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
        colorScheme: 'dark',
        locale: 'en-US',
        video: {
            mode: 'on',
            dir: './videos/'
        },
        navigationTimeout: 90000,
        actionTimeout: 60000,
    },
    reporter: [
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results.json' }]
    ],
    outputDir: './test-results',
});