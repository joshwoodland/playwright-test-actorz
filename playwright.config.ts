import { defineConfig } from '@playwright/test';
export default defineConfig({
    timeout: 120000,
    retries: 1,
    testDir: './tests',
    testMatch: '*.test.ts',
    use: {
        headless: true,
        viewport: { width: 1920, height: 720 },
        ignoreHTTPSErrors: true,
        colorScheme: 'dark',
        locale: 'en-US',
        video: {
            mode: 'on',
            dir: './videos/'
        },
        navigationTimeout: 60000,
        actionTimeout: 30000,
    },
    reporter: [
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results.json' }]
    ],
    outputDir: './test-results',
});