import { Actor } from 'apify';
import log from '@apify/log';
import { Dictionary } from 'apify-client';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { collectAttachmentPaths, transformToTabular, Attachment } from './transform';

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
        video: {
            mode: '${video}',
            dir: 'videos'
        },
    },
    reporter: [
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results.json' }]
    ],
});`
}

function runTests(envVars: { [key: string]: string }) {
    try {
        // Get credentials from Apify environment variables
        const email = process.env.EMAIL;
        const password = process.env.PASSWORD;

        if (!email || !password) {
            throw new Error('EMAIL and PASSWORD environment variables must be set');
        }

        execSync(`npx playwright test --config=${__dirname}/playwright.config.ts`, {
            cwd: __dirname,
            encoding: 'utf8',
            stdio: 'inherit',
            env: {
                ...process.env,
                ...envVars,
                EMAIL: email,
                PASSWORD: password
            },
        });
    } catch (e) {
        log.error('Error running tests:', e);
        throw e;
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
        EMAIL: process.env.EMAIL || '',
        PASSWORD: process.env.PASSWORD || '',
        API_ENDPOINT: input['apiEndpoint'] as string,
        PATIENT_NAME: patientName,
        MEDICATIONS: medications
    });

    const kvs = await Actor.openKeyValueStore();
    await kvs.setValue('report', fs.readFileSync(path.join(__dirname, 'playwright-report', 'index.html'), { encoding: 'utf-8' }), { contentType: 'text/html' });

    // Store video files if they exist
    try {
        const videoDir = path.join(__dirname, 'videos');
        log.info('Checking for videos in:', videoDir);
        
        if (fs.existsSync(videoDir)) {
            const files = fs.readdirSync(videoDir);
            log.info(`Found ${files.length} video files`);
            
            for (const file of files) {
                if (file.endsWith('.webm')) {
                    const videoPath = path.join(videoDir, file);
                    log.info('Reading video file:', videoPath);
                    
                    const videoBuffer = fs.readFileSync(videoPath);
                    const key = `video-${Date.now()}-${file}`;
                    
                    log.info(`Uploading video with key: ${key}`);
                    await kvs.setValue(key, videoBuffer, { 
                        contentType: 'video/webm',
                        fileName: file
                    });
                    log.info(`Successfully uploaded video: ${key}`);
                }
            }
        } else {
            log.warning('Video directory not found:', videoDir);
        }
    } catch (error) {
        log.error('Error handling video files:', error);
    }

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
