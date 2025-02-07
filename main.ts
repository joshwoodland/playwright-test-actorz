import { Actor } from 'apify';
import log from '@apify/log';
import { Dictionary } from 'apify-client';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { collectAttachmentPaths, transformToTabular, Attachment } from './transform';

// Define constant for video directory path
const VIDEO_DIR = path.join(__dirname, 'videos');

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
        // Get credentials from environment variables or input
        const email = process.env.EMAIL || envVars.EMAIL;
        const password = process.env.PASSWORD || envVars.PASSWORD;

        if (!email || !password) {
            log.warning('No credentials found in environment variables or input');
        }

        execSync(`npx playwright test --config=${__dirname}/playwright.config.ts`, {
            cwd: __dirname,
            encoding: 'utf8',
            stdio: 'inherit',
            env: {
                ...process.env,
                ...envVars,
                EMAIL: email || '',  // Ensure we pass empty string rather than undefined
                PASSWORD: password || ''
            },
        });
    } catch (e) {
        log.error('Error running tests:', { error: e instanceof Error ? e.message : String(e) });
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
        video = 'on'
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

    // Set memory if specified in input
    if (input['memory']) {
        await Actor.setMemoryMbytes(input['memory'] as number);
    }

    storeTestCode({
        contents: input['testCode'] as string,
        path: path.join(__dirname, 'tests', 'test.spec.ts')
    });

    updateConfig(input);

    // Pass all input values as environment variables
    runTests({
        API_ENDPOINT: input['apiEndpoint'] as string || '',
        EMAIL: input['email'] as string || '',
        PASSWORD: input['password'] as string || '',
        PATIENT_NAME: input['patientName'] as string || 'Unknown Patient',
        MEDICATIONS: Array.isArray(input['medications']) ? input['medications'].join(', ') : ''
    });

    // Store video files if they exist
    try {
        // Get the default key-value store for this run
        const kvs = await Actor.openKeyValueStore();
        log.info('Using run-specific key-value store', { 
            storeId: kvs.id
        });

        // Store the HTML report
        await kvs.setValue('report.html', fs.readFileSync(path.join(__dirname, 'playwright-report', 'index.html'), { encoding: 'utf-8' }), { contentType: 'text/html' });
        
        log.info('Video directory configuration', { 
            configuredPath: VIDEO_DIR,
            exists: fs.existsSync(VIDEO_DIR),
            absolutePath: path.resolve(VIDEO_DIR)
        });
        
        if (fs.existsSync(VIDEO_DIR)) {
            const files = fs.readdirSync(VIDEO_DIR);
            log.info('Found video files', { 
                count: files.length,
                files: files,
                directory: VIDEO_DIR
            });
            
            for (const file of files) {
                if (file.endsWith('.webm')) {
                    const videoPath = path.join(VIDEO_DIR, file);
                    log.info('Processing video file', { 
                        path: videoPath,
                        size: fs.statSync(videoPath).size
                    });
                    
                    const videoBuffer = fs.readFileSync(videoPath);
                    const key = `video-${file}`; // Simplified key for better identification
                    
                    log.info('Uploading video to run storage', { key, size: videoBuffer.length });
                    await kvs.setValue(key, videoBuffer, { 
                        contentType: 'video/webm'
                    });
                    log.info('Successfully uploaded video to run storage', { key });
                }
            }
        } else {
            log.warning('Video directory not found', { 
                path: VIDEO_DIR,
                cwd: process.cwd(),
                dirContents: fs.readdirSync(process.cwd())
            });
        }

        // Process other attachments
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

    } catch (error) {
        log.error('Error handling storage', { 
            error: error instanceof Error ? error.message : String(error),
            videoDir: VIDEO_DIR,
            cwd: process.cwd()
        });
    }

    await Actor.exit();
})();
