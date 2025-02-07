import { Actor, Configuration } from 'apify';
import log from '@apify/log';
import { Dictionary } from 'apify-client';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { collectAttachmentPaths, transformToTabular, Attachment } from './transform';

// Define constant for video directory path
const VIDEO_DIR = path.join(__dirname, 'videos');

// Define input interface for better type safety
interface ActorInput {
    patientName?: string;
    medications?: string[];
    email?: string;
    password?: string;
    apiEndpoint?: string;
    memory?: number;
    screenWidth?: number;
    screenHeight?: number;
    headful?: boolean;
    timeout?: number;
    darkMode?: boolean;
    locale?: string;
    video?: string;
}

// Log important environment variables at startup
function logEnvironmentInfo() {
    const envVars = {
        actorId: process.env.ACTOR_ID,
        runId: process.env.ACTOR_RUN_ID,
        taskId: process.env.ACTOR_TASK_ID,
        buildNumber: process.env.ACTOR_BUILD_NUMBER,
        buildId: process.env.ACTOR_BUILD_ID,
        defaultDatasetId: process.env.ACTOR_DEFAULT_DATASET_ID,
        defaultKeyValueStoreId: process.env.ACTOR_DEFAULT_KEY_VALUE_STORE_ID,
        memoryMbytes: process.env.ACTOR_MEMORY_MBYTES,
        isAtHome: process.env.APIFY_IS_AT_HOME,
        startedAt: process.env.ACTOR_STARTED_AT,
        timeoutAt: process.env.ACTOR_TIMEOUT_AT,
        containerUrl: process.env.ACTOR_WEB_SERVER_URL,
    };

    log.info('Actor environment:', envVars);
}

// Generate dynamic test code based on input parameters
function generateTestCode(input: ActorInput): string {
    const { patientName = 'Default Patient', medications = [] } = input;
    
    return `import { test, expect } from '@playwright/test';

// Test data from HTTP query parameters
const PATIENT_NAME = '${patientName}';
const MEDICATIONS = ${JSON.stringify(medications)};

test('Dynamic patient data automation', async ({ page }) => {
    // Log run context
    console.log('Actor Run ID:', process.env.ACTOR_RUN_ID);
    console.log('Task ID:', process.env.ACTOR_TASK_ID || 'No task (direct run)');
    
    // 🔐 1. Log in
    await page.goto('https://www.simplepractice.com');
    await page.click('text=Sign In');
    
    // Use environment variables for credentials
    await page.fill('input[name="email"]', process.env.EMAIL);
    await page.fill('input[name="password"]', process.env.PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForURL('https://secure.simplepractice.com/**');
    
    // 🔍 2. Search for patient
    await page.getByPlaceholder('Search').fill(PATIENT_NAME);
    await page.getByRole('link', { name: PATIENT_NAME }).click();
    
    // ✅ 3. Verify patient details
    await expect(page.locator('.patient-name')).toHaveText(PATIENT_NAME);
    
    // 💊 4. Check medications
    if (MEDICATIONS.length > 0) {
        const medicationsList = page.locator('.medications-list');
        for (const medication of MEDICATIONS) {
            await expect(medicationsList).toContainText(medication);
        }
        
        // Log medications found
        console.log('Verified medications:', MEDICATIONS);
    }
    
    // 📸 5. Take evidence screenshots with run ID in filename
    const screenshotPath = \`patient-details-\${process.env.ACTOR_RUN_ID}.png\`;
    await page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
    });
    
    // 📝 6. Log success with run context
    console.log('Successfully verified patient:', {
        name: PATIENT_NAME,
        medicationsCount: MEDICATIONS.length,
        runId: process.env.ACTOR_RUN_ID,
        taskId: process.env.ACTOR_TASK_ID
    });
});`;
}

// Generate Playwright configuration
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
    
    // Log environment information
    logEnvironmentInfo();
    
    // Get the global configuration
    const config = Configuration.getGlobalConfig();
    
    // Get input with type safety
    const input = await Actor.getInput() as ActorInput;
    log.info('Received input parameters', {
        hasPatientName: !!input.patientName,
        hasMedications: !!input.medications,
        patientNameLength: input.patientName?.length,
        medicationsCount: input.medications?.length,
        configuredMemory: config.get('memoryMbytes'),
        isAtHome: config.get('isAtHome'),
        defaultKeyValueStoreId: config.get('defaultKeyValueStoreId')
    });

    // Set memory using Configuration
    if (input.memory) {
        config.set('memoryMbytes', input.memory);
    }

    // Generate and store dynamic test code
    const dynamicTestCode = generateTestCode(input);
    storeTestCode({
        contents: dynamicTestCode,
        path: path.join(__dirname, 'tests', 'test.spec.ts')
    });

    // Update configuration with input parameters
    updateConfig({
        screenWidth: input.screenWidth,
        screenHeight: input.screenHeight,
        headful: input.headful || config.get('headless') === false,
        timeout: input.timeout,
        darkMode: input.darkMode,
        locale: input.locale,
        video: input.video
    });

    // Process patient data with defaults
    const patientName = input.patientName || 'Default Patient';
    const medications = Array.isArray(input.medications) ? input.medications : [];
    
    // Get run context with fallbacks
    const runId = process.env.ACTOR_RUN_ID || 'local-run';
    const taskId = process.env.ACTOR_TASK_ID || 'no-task';
    
    log.info('Processing patient data', {
        patientName,
        medicationsCount: medications.length,
        medications: medications,
        runId,
        taskId
    });

    // Pass all input values as environment variables
    runTests({
        EMAIL: input.email || '',
        PASSWORD: input.password || '',
        PATIENT_NAME: patientName,
        MEDICATIONS: medications.join(', '),
        ACTOR_RUN_ID: runId,
        ACTOR_TASK_ID: taskId
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
        const jsonReport = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-results.json'), { encoding: 'utf-8 }));
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
