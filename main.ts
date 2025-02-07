import { Actor, Configuration } from 'apify';
import log from '@apify/log';
import { Dictionary } from 'apify-client';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { collectAttachmentPaths, transformToTabular, Attachment } from './transform';

// Define global type for test results
declare global {
    var __TEST_RESULTS__: {
        patientName: string;
        medications: string;
        nextAppointment: string | null;
        requestId: string;
        calculatedAt: string;
        message: string;
    } | undefined;
}

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
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

test('Patient appointment verification', async ({ page }) => {
    try {
        // Get environment variables
        const email = process.env.EMAIL;
        const password = process.env.PASSWORD;
        const patientName = process.env.PATIENT_NAME;
        const medications = process.env.MEDICATIONS?.split(',').map(med => med.trim()) || [];

        if (!email || !password || !patientName || medications.length === 0) {
            throw new Error('Missing required environment variables: EMAIL, PASSWORD, PATIENT_NAME, MEDICATIONS');
        }

        // 📋 Log test start
        console.log('🚀 Starting test automation');

        // 🔐 1. Log in
        console.log('🔑 Attempting login...');
        await page.goto('https://www.simplepractice.com', { waitUntil: 'networkidle' });
        console.log('✅ Page loaded');

        // Wait for and click sign in button
        const signInButton = page.getByTestId('signIn-tryItFree-wrapper').getByRole('link', { name: 'Sign in' });
        await signInButton.waitFor({ state: 'visible', timeout: 5000 });
        await signInButton.click();
        console.log('✅ Clicked sign in button');

        // Wait for and fill login form
        const emailInput = page.getByLabel('Email');
        const passwordInput = page.getByLabel('Password');
        await Promise.all([
            emailInput.waitFor({ state: 'visible', timeout: 5000 }),
            passwordInput.waitFor({ state: 'visible', timeout: 5000 })
        ]);
        await emailInput.fill(email);
        await passwordInput.fill(password);

        // Click sign in and wait for dashboard
        await page.getByRole('button', { name: 'Sign in' }).click();
        
        // Wait for the search clients input to be visible (indicates successful login)
        console.log('⏳ Waiting for login to complete...');
        const searchInput = page.getByPlaceholder('Search clients');
        await searchInput.waitFor({ state: 'visible', timeout: 30000 });
        console.log('✅ Login successful');
        
        // 🔍 2. Search for patient
        console.log('🔎 Searching for patient:', patientName);
        await searchInput.click();
        await searchInput.fill(patientName);
        await page.keyboard.press('Enter');
        
        // Wait for patient link and click
        const patientLink = page.getByRole('link', { name: patientName });
        await patientLink.waitFor({ state: 'visible', timeout: 10000 });
        await patientLink.click();
        
        // Wait for patient name in header/title
        const patientHeader = page.getByText(patientName).first();
        await patientHeader.waitFor({ state: 'visible', timeout: 10000 });
        console.log('✅ Patient found');

        // 📅 3. Find next appointment
        console.log('🔍 Looking for next appointment...');
        const nextApptElement = await page.getByText('Next Appt', { exact: false });
        await nextApptElement.waitFor({ state: 'visible', timeout: 10000 });
        const nextApptText = await nextApptElement.textContent();
        console.log('Found appointment text:', nextApptText);
        
        // Try to extract date with multiple patterns
        let nextApptDate = null;
        const datePatterns = [
            /\\d{2}\\/\\d{2}\\/\\d{4}/,
            /\\d{1,2}\\/\\d{1,2}\\/\\d{4}/,
            /\\d{4}-\\d{2}-\\d{2}/,
            /[A-Za-z]+ \\d{1,2},? \\d{4}/
        ];

        for (const pattern of datePatterns) {
            const match = nextApptText?.match(pattern)?.[0];
            if (match) {
                console.log('Found date match:', match);
                nextApptDate = match;
                break;
            }
        }

        if (!nextApptDate) {
            console.log('⚠️ Could not extract date from text:', nextApptText);
        }
        
        // ⏰ 4. Calculate days and prepare message
        const today = new Date();
        let diffDays = 0;
        let appointmentMessage = '';

        if (nextApptDate) {
            const apptDate = new Date(nextApptDate);
            const diffTime = Math.abs(apptDate.getTime() - today.getTime());
            diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            appointmentMessage = \`📅 NEXT APPOINTMENT: \${nextApptDate}\\n❓ Would you like me to proceed with a \${diffDays + 5}-day supply for the patient?\`;
        } else {
            console.log('⚠️ No future appointment found');
            appointmentMessage = \`⚠️ NO FUTURE APPOINTMENT SCHEDULED\\n❓ How would you like to proceed with this patient's medication refill?\`;
        }
        
        // 📝 5. Generate message
        const requestId = uuidv4().substring(0, 9);
        const currentTime = today.toLocaleString('en-US');
        
        const message = \`📋 MEDICATION REFILL REQUEST

👤 PATIENT NAME: \${patientName}
💊 MEDICATIONS: \${medications.join(', ').toLowerCase()}
⏰ CALCULATED AT: \${currentTime}
🔍 REQUEST ID: \${requestId}

\${appointmentMessage}\`;

        // 📊 6. Store data for dataset
        const testResults = {
            patientName,
            medications: medications.join(', ').toLowerCase(),
            nextAppointment: nextApptDate || null,
            requestId,
            calculatedAt: currentTime,
            message
        };

        // Store in global object for main process to handle
        global.__TEST_RESULTS__ = testResults;
        console.log('✅ Data collected for dataset');

        // 📸 7. Take evidence screenshots
        await page.screenshot({ 
            path: path.join('test-results', \`patient-details-\${process.env.ACTOR_RUN_ID || 'test'}.png\`),
            fullPage: true 
        });
        
        // ✅ 8. Log success
        console.log('🎉 Test completed successfully');

    } catch (error) {
        // 🚨 Error handling
        console.error('❌ Test failed:', {
            error: error.message,
            step: error.name
        });
        
        try {
            // Only attempt screenshot if page is still open
            if (!page.isClosed()) {
                await page.screenshot({ 
                    path: path.join('test-results', \`error-state-\${process.env.ACTOR_RUN_ID || 'test'}.png\`),
                    fullPage: true 
                });
            } else {
                console.log('⚠️ Could not take error screenshot - page was already closed');
            }
        } catch (screenshotError) {
            console.log('⚠️ Failed to capture error screenshot:', screenshotError.message);
        }
        
        throw error;
    }
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

    // Run tests and collect results
    runTests({
        EMAIL: input.email || '',
        PASSWORD: input.password || '',
        PATIENT_NAME: patientName,
        MEDICATIONS: medications.join(', '),
        ACTOR_RUN_ID: runId,
        ACTOR_TASK_ID: taskId
    });

    // Store test results in dataset if available
    if (global.__TEST_RESULTS__) {
        const dataset = await Actor.openDataset();
        await dataset.pushData(global.__TEST_RESULTS__);
        log.info('Test results stored in dataset');
    }

    // Store screenshots and other artifacts
    try {
        const kvs = await Actor.openKeyValueStore();
        log.info('Using run-specific key-value store', { 
            storeId: kvs.id
        });

        // Store screenshots if they exist
        const screenshotFiles = [
            `patient-details-${process.env.ACTOR_RUN_ID || 'test'}.png`,
            `error-state-${process.env.ACTOR_RUN_ID || 'test'}.png`
        ];

        for (const file of screenshotFiles) {
            const screenshotPath = path.join(__dirname, file);
            if (fs.existsSync(screenshotPath)) {
                log.info('Processing screenshot', { path: screenshotPath });
                const screenshotBuffer = fs.readFileSync(screenshotPath);
                await kvs.setValue(file, screenshotBuffer, { contentType: 'image/png' });
                log.info('Screenshot stored in key-value store', { key: file });
            }
        }

        // Store the HTML report
        const reportPath = path.join(__dirname, 'playwright-report', 'index.html');
        if (fs.existsSync(reportPath)) {
            await kvs.setValue('report.html', fs.readFileSync(reportPath, { encoding: 'utf-8' }), { contentType: 'text/html' });
            log.info('HTML report stored in key-value store');
        }

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

        try {
            // Process test results and attachments
            const testResultsPath = path.join(__dirname, 'test-results.json');
            if (fs.existsSync(testResultsPath)) {
                const jsonReport = JSON.parse(fs.readFileSync(testResultsPath, { encoding: 'utf-8' }));
                const paths = collectAttachmentPaths(jsonReport);
                
                const links = await Promise.all(paths.map(async (attachment: Attachment) => {
                    const content = fs.readFileSync(path.join(__dirname, attachment.path));
                    const key = attachment.key;
                    await kvs.setValue(key, content, { contentType: attachment.type });
                    return {
                        ...attachment,
                        url: `https://api.apify.com/v2/key-value-stores/${kvs.id}/records/${key}`
                    };
                }));

                const dataset = await Actor.openDataset();
                await dataset.pushData(transformToTabular(jsonReport, links));
            } else {
                log.warning('Test results file not found', { path: testResultsPath });
            }
        } catch (testError) {
            log.error('Error processing test results', {
                error: testError instanceof Error ? testError.message : String(testError)
            });
        }

    } catch (error) {
        log.error('Error handling storage', { 
            error: error instanceof Error ? error.message : String(error),
            videoDir: VIDEO_DIR,
            cwd: process.cwd()
        });
    }

    await Actor.exit();
})();
