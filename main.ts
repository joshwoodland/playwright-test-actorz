import { Actor } from 'apify';
import log from '@apify/log';
import { Dictionary } from 'apify-client';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { collectAttachmentPaths, transformToTabular, Attachment } from './transform';

// 🔐 1. Internal credentials (hardcoded)
const EMAIL = 'smartwoodland@gmail.com';
const PASSWORD = 'Mentalhealthsdf245';

const getConfig = (options: { screen: { width: number, height: number }, headful: boolean, timeout: number, locale: string, darkMode: boolean, ignoreHTTPSErrors: boolean, video: string }) => {
    const { screen, headful, timeout, ignoreHTTPSErrors, darkMode, locale, video } = options;

    return `import { defineConfig } from '@playwright/test';
export default defineConfig({
    timeout: ${timeout},
    use: {
        headless: ${!headful},
        viewport: { width: ${screen.width}, height: ${screen.height} },
        ignoreHTTPSErrors: ${ignoreHTTPSErrors},
        colorScheme: '${darkMode ? 'dark' : 'light'}',
        locale: '${locale}',
        video: '${video}',
    },
    reporter: [
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results.json' }]
    ],
});`
}

function runTests(envVars: { [key: string]: string }) {
    try {
        execSync(`npx playwright test --config=${__dirname}/playwright.config.ts`, {
            cwd: __dirname,
            encoding: 'utf8',
            stdio: 'inherit',
            env: {
                ...process.env,
                ...envVars, // Pass environment variables to Playwright
            },
        });
    } catch (e) {
        // suppress error, the report will be generated anyway
    }
}

function storeTestCode(args: { contents: string, path: string }) {
    return fs.writeFileSync(args.path, args.contents as string, { encoding: 'utf-8' });
}

function updateConfig(args: {
    screenWidth?: number,
    screenHeight?: number,
    headful?: boolean,
    timeout?: number,
    darkMode?: boolean,
    locale?: string,
    ignoreHTTPSErrors?: boolean,
    video?: string,
}) {
    const {
        screenWidth = 1280,
        screenHeight = 720,
        headful = false,
        timeout = 60,
        darkMode = false,
        locale = 'en-US',
        ignoreHTTPSErrors = true,
        video = 'off'
    } = args;

    const config = getConfig({
        screen: { width: screenWidth, height: screenHeight },
        headful,
        timeout: timeout * 1000,
        locale,
        darkMode,
        ignoreHTTPSErrors,
        video
    });
    fs.writeFileSync(path.join(__dirname, 'playwright.config.ts'), config, { encoding: 'utf-8' });
}

(async () => {
    await Actor.init();
    const input = await Actor.getInput() as Dictionary;

    // 📥 2. Get patient data dynamically
    const patientName = (input['patientName'] as string) || 'Unknown Patient';
    const medications = Array.isArray(input['medications']) ? input['medications'].join(', ') : '';

    storeTestCode({
        contents: input['testCode'] as string,
        path: path.join(__dirname, 'tests', 'test.spec.ts')
    });

    updateConfig(input);

    // 🚀 3. Pass patient data + internal credentials to Playwright as ENV variables
    runTests({
        EMAIL,
        PASSWORD,
        PATIENT_NAME: patientName,
        MEDICATIONS: medications
    });

    const kvs = await Actor.openKeyValueStore();
    await kvs.setValue('report', fs.readFileSync(path.join(__dirname, 'playwright-report', 'index.html'), { encoding: 'utf-8' }), { contentType: 'text/html' });

    const jsonReport = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-results.json'), { encoding: 'utf-8' }));
    const attachmentPaths = collectAttachmentPaths(jsonReport);

    const attachmentLinks = await Promise.all(attachmentPaths.map(async (attachment: Attachment) => {
        const content = fs.readFileSync(path.join(__dirname, attachment.path));
        const key = attachment.key;
        await kvs.setValue(key, content, { contentType: attachment.type });
        return {
            ...attachment,
            url: `https://api.apify.com/v2/key-value-stores/${kvs.id}/records/${key}`
        };
    }));

    const dataset = await Actor.openDataset();
    await dataset.pushData(transformToTabular(jsonReport, attachmentLinks));

    await Actor.exit();
})();
