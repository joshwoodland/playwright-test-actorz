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

        // Try multiple strategies to find and click the sign-in button
        async function findAndClickSignIn() {
            const strategies = [
                // Strategy 1: By test ID
                async () => {
                    const button = page.getByTestId('signIn-tryItFree-wrapper').getByRole('link', { name: 'Sign in' });
                    await button.waitFor({ state: 'visible', timeout: 5000 });
                    await button.click();
                    return true;
                },
                // Strategy 2: By exact text
                async () => {
                    const button = page.getByText('Sign in', { exact: true });
                    await button.waitFor({ state: 'visible', timeout: 5000 });
                    await button.click();
                    return true;
                },
                // Strategy 3: By role and name
                async () => {
                    const button = page.getByRole('link', { name: /sign.?in/i });
                    await button.waitFor({ state: 'visible', timeout: 5000 });
                    await button.click();
                    return true;
                },
                // Strategy 4: By CSS selector
                async () => {
                    const button = page.locator('a:has-text("Sign in"), a:has-text("Sign In")').first();
                    await button.waitFor({ state: 'visible', timeout: 5000 });
                    await button.click();
                    return true;
                }
            ];

            for (const strategy of strategies) {
                try {
                    if (await strategy()) {
                        return true;
                    }
                } catch (e) {
                    console.log('Strategy failed, trying next one...');
                }
            }
            throw new Error('All sign-in button strategies failed');
        }

        await findAndClickSignIn();
        console.log('✅ Clicked sign in button');

        // Wait for login form with multiple strategies
        async function findAndFillLoginForm() {
            const strategies = [
                // Strategy 1: By label
                async () => {
                    const emailInput = page.getByLabel('Email');
                    const passwordInput = page.getByLabel('Password');
                    await Promise.all([
                        emailInput.waitFor({ state: 'visible', timeout: 5000 }),
                        passwordInput.waitFor({ state: 'visible', timeout: 5000 })
                    ]);
                    await emailInput.fill(email);
                    await passwordInput.fill(password);
                    return true;
                },
                // Strategy 2: By placeholder
                async () => {
                    const emailInput = page.getByPlaceholder('Email');
                    const passwordInput = page.getByPlaceholder('Password');
                    await Promise.all([
                        emailInput.waitFor({ state: 'visible', timeout: 5000 }),
                        passwordInput.waitFor({ state: 'visible', timeout: 5000 })
                    ]);
                    await emailInput.fill(email);
                    await passwordInput.fill(password);
                    return true;
                },
                // Strategy 3: By type and name attributes
                async () => {
                    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
                    const passwordInput = page.locator('input[type="password"]').first();
                    await Promise.all([
                        emailInput.waitFor({ state: 'visible', timeout: 5000 }),
                        passwordInput.waitFor({ state: 'visible', timeout: 5000 })
                    ]);
                    await emailInput.fill(email);
                    await passwordInput.fill(password);
                    return true;
                }
            ];

            for (const strategy of strategies) {
                try {
                    if (await strategy()) {
                        return true;
                    }
                } catch (e) {
                    console.log('Login form strategy failed, trying next one...');
                }
            }
            throw new Error('All login form strategies failed');
        }

        await findAndFillLoginForm();
        
        // Find and click the submit button
        async function findAndClickSubmit() {
            const strategies = [
                // Strategy 1: By role and name
                async () => {
                    const button = page.getByRole('button', { name: /sign.?in/i });
                    await button.waitFor({ state: 'visible', timeout: 5000 });
                    await button.click();
                    return true;
                },
                // Strategy 2: By type submit
                async () => {
                    const button = page.locator('button[type="submit"]').first();
                    await button.waitFor({ state: 'visible', timeout: 5000 });
                    await button.click();
                    return true;
                },
                // Strategy 3: By form submission
                async () => {
                    const form = page.locator('form').first();
                    await form.evaluate(form => form.submit());
                    return true;
                }
            ];

            for (const strategy of strategies) {
                try {
                    if (await strategy()) {
                        return true;
                    }
                } catch (e) {
                    console.log('Submit button strategy failed, trying next one...');
                }
            }
            throw new Error('All submit button strategies failed');
        }

        await findAndClickSubmit();
        
        // Wait for login to complete with multiple success indicators
        async function waitForLoginSuccess() {
            const strategies = [
                // Strategy 1: URL change
                async () => {
                    await page.waitForURL('https://secure.simplepractice.com/**', { timeout: 30000 });
                    return true;
                },
                // Strategy 2: Dashboard element
                async () => {
                    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });
                    return true;
                },
                // Strategy 3: Navigation menu
                async () => {
                    await page.waitForSelector('nav, .navigation, .menu', { timeout: 30000 });
                    return true;
                }
            ];

            for (const strategy of strategies) {
                try {
                    if (await strategy()) {
                        return true;
                    }
                } catch (e) {
                    console.log('Login success check strategy failed, trying next one...');
                }
            }
            throw new Error('Could not verify successful login');
        }

        await waitForLoginSuccess();
        console.log('✅ Login successful');
        
        // 🔍 2. Search for patient with retries
        console.log('🔎 Searching for patient:', patientName);
        async function findAndSearchPatient() {
            const strategies = [
                // Strategy 1: By placeholder
                async () => {
                    console.log('Trying search strategy 1: By placeholder');
                    const searchInput = page.getByPlaceholder('Search');
                    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
                    await searchInput.click();
                    await searchInput.fill(patientName);
                    await page.keyboard.press('Enter');
                    return true;
                },
                // Strategy 2: By role
                async () => {
                    console.log('Trying search strategy 2: By role');
                    const searchInput = page.getByRole('searchbox');
                    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
                    await searchInput.click();
                    await searchInput.fill(patientName);
                    await page.keyboard.press('Enter');
                    return true;
                },
                // Strategy 3: By common search selectors
                async () => {
                    console.log('Trying search strategy 3: By common search selectors');
                    const searchInput = page.locator('input[type="search"], .search-input, #search').first();
                    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
                    await searchInput.click();
                    await searchInput.fill(patientName);
                    await page.keyboard.press('Enter');
                    return true;
                },
                // Strategy 4: By aria-label
                async () => {
                    console.log('Trying search strategy 4: By aria-label');
                    const searchInput = page.locator('[aria-label*="search" i], [aria-label*="find" i]').first();
                    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
                    await searchInput.click();
                    await searchInput.fill(patientName);
                    await page.keyboard.press('Enter');
                    return true;
                }
            ];

            for (const strategy of strategies) {
                try {
                    if (await strategy()) {
                        return true;
                    }
                } catch (e) {
                    console.log('Search strategy failed, trying next one...', e.message);
                }
            }
            throw new Error('All search strategies failed');
        }

        await findAndSearchPatient();
        console.log('✅ Search input completed');

        // Wait for search results to load
        console.log('Waiting for search results...');
        try {
            await page.waitForLoadState('networkidle', { timeout: 10000 });
            console.log('Network activity settled');
        } catch (e) {
            console.log('Network activity timeout, proceeding anyway');
        }

        // Additional wait for search results to render
        await page.waitForTimeout(2000);
        console.log('Extra wait completed');

        // Wait for and click patient link with enhanced logging
        async function findAndClickPatient() {
            console.log('Looking for patient link with name:', patientName);
            const strategies = [
                // Strategy 1: By role and name
                async () => {
                    console.log('Trying patient link strategy 1: By role and name');
                    const link = page.getByRole('link', { name: patientName });
                    await link.waitFor({ state: 'visible', timeout: 5000 });
                    const isVisible = await link.isVisible();
                    console.log('Link visible status:', isVisible);
                    const linkText = await link.textContent();
                    console.log('Link text content:', linkText);
                    if (!linkText?.includes(patientName)) {
                        console.log('Link text does not match patient name');
                        return false;
                    }
                    // Click with navigation verification
                    console.log('Attempting to click link...');
                    const [response] = await Promise.all([
                        page.waitForNavigation({ timeout: 10000 }),
                        link.click()
                    ]);
                    console.log('Navigation completed, new URL:', response?.url());
                    return true;
                },
                // Strategy 2: By text content
                async () => {
                    console.log('Trying patient link strategy 2: By text content');
                    const link = page.getByText(patientName, { exact: true });
                    await link.waitFor({ state: 'visible', timeout: 5000 });
                    const isVisible = await link.isVisible();
                    console.log('Link visible status:', isVisible);
                    const linkText = await link.textContent();
                    console.log('Link text content:', linkText);
                    if (!linkText?.includes(patientName)) {
                        console.log('Link text does not match patient name');
                        return false;
                    }
                    await link.click();
                    return true;
                },
                // Strategy 3: By partial match
                async () => {
                    console.log('Trying patient link strategy 3: By partial match');
                    const link = page.locator(`a:has-text("${patientName}")`).first();
                    await link.waitFor({ state: 'visible', timeout: 5000 });
                    const isVisible = await link.isVisible();
                    console.log('Link visible status:', isVisible);
                    const linkText = await link.textContent();
                    console.log('Link text content:', linkText);
                    if (!linkText?.includes(patientName)) {
                        console.log('Link text does not match patient name');
                        return false;
                    }
                    await link.click();
                    return true;
                },
                // Strategy 4: By table cell or list item
                async () => {
                    console.log('Trying patient link strategy 4: By table/list content');
                    const element = page.locator('tr, li').filter({ hasText: patientName }).first();
                    await element.waitFor({ state: 'visible', timeout: 5000 });
                    const isVisible = await element.isVisible();
                    console.log('Element visible status:', isVisible);
                    const elementText = await element.textContent();
                    console.log('Element text content:', elementText);
                    if (!elementText?.includes(patientName)) {
                        console.log('Element text does not match patient name');
                        return false;
                    }
                    await element.click();
                    return true;
                },
                // Strategy 5: By fuzzy match
                async () => {
                    console.log('Trying patient link strategy 5: By fuzzy match');
                    const nameParts = patientName.split(' ');
                    const fuzzySelector = nameParts.map(part => `:has-text("${part}")`).join('');
                    const element = page.locator(`a${fuzzySelector}`).first();
                    await element.waitFor({ state: 'visible', timeout: 5000 });
                    const isVisible = await element.isVisible();
                    console.log('Element visible status:', isVisible);
                    const elementText = await element.textContent();
                    console.log('Element text content:', elementText);
                    if (!elementText?.includes(patientName)) {
                        console.log('Element text does not match patient name');
                        return false;
                    }
                    await element.click();
                    return true;
                }
            ];

            // Log the current page content for debugging
            console.log('Current page content:', await page.content());

            for (const strategy of strategies) {
                try {
                    if (await strategy()) {
                        return true;
                    }
                } catch (e) {
                    console.log('Patient link strategy failed, trying next one...', e.message);
                }
            }
            throw new Error('All patient link strategies failed');
        }

        await findAndClickPatient();
        console.log('✅ Patient link clicked');
        
        // Wait for patient page to load with enhanced verification
        console.log('Waiting for patient page to load...');
        
        // Define success indicators for patient page load
        const pageLoadStrategies = [
            // Strategy 1: URL verification
            async () => {
                const currentUrl = page.url();
                console.log('Current URL:', currentUrl);
                if (currentUrl.includes('/clients/') && currentUrl.includes('/overview')) {
                    return 'URL indicates patient page';
                }
                return false;
            },
            // Strategy 2: Quick check for any patient content
            async () => {
                const content = await page.content();
                if (content.includes(patientName)) {
                    return 'Patient name found in content';
                }
                return false;
            }
        ];

        let pageLoadSuccess = false;
        for (const strategy of pageLoadStrategies) {
            try {
                const result = await strategy();
                if (result) {
                    console.log('Page load verified:', result);
                    pageLoadSuccess = true;
                    break;
                }
            } catch (e) {
                console.log('Page load check failed:', e.message);
            }
        }

        if (!pageLoadSuccess) {
            console.log('⚠️ Could not verify patient page load');
            console.log('Current page content:', await page.content());
            throw new Error('Failed to verify patient page load');
        }

        console.log('✅ Patient page verified');

        // 📅 3. Find next appointment with multiple strategies
        console.log('🔍 Looking for next appointment...');
        async function findNextAppointment() {
            const strategies = [
                // Strategy 1: By text content
                async () => {
                    console.log('Trying appointment strategy 1: By text content');
                    const element = await page.getByText(/next appt|upcoming|scheduled/i, { exact: false });
                    const text = await element.textContent();
                    console.log('Found text:', text);
                    return text;
                },
                // Strategy 2: By appointment section
                async () => {
                    console.log('Trying appointment strategy 2: By appointment section');
                    const element = await page.locator('[data-testid*="appointment"], [class*="appointment"], .appointments, #appointments').first();
                    const text = await element.textContent();
                    console.log('Found text:', text);
                    return text;
                },
                // Strategy 3: By date pattern
                async () => {
                    console.log('Trying appointment strategy 3: By date pattern');
                    const element = await page.locator('text=/[0-9]{2}\/[0-9]{2}\/[0-9]{4}/').first();
                    const text = await element.textContent();
                    console.log('Found text:', text);
                    return text;
                },
                // Strategy 4: By calendar section
                async () => {
                    console.log('Trying appointment strategy 4: By calendar section');
                    const element = await page.locator('[data-testid*="calendar"], [class*="calendar"], #calendar').first();
                    const text = await element.textContent();
                    console.log('Found text:', text);
                    return text;
                },
                // Strategy 5: By overview section
                async () => {
                    console.log('Trying appointment strategy 5: By overview section');
                    const element = await page.locator('.overview, #overview, [data-testid*="overview"]').first();
                    const text = await element.textContent();
                    console.log('Found text:', text);
                    return text;
                }
            ];

            // Log the current page content for debugging
            console.log('Current page content:', await page.content());

            for (const strategy of strategies) {
                try {
                    const text = await strategy();
                    if (text) {
                        console.log('Strategy succeeded with text:', text);
                        return text;
                    }
                } catch (e) {
                    console.log('Appointment search strategy failed:', e.message);
                }
            }
            console.log('⚠️ No future appointment found with any strategy');
            return null;
        }

        const nextApptText = await findNextAppointment();
        console.log('Next appointment text found:', nextApptText);
        
        // Try to extract date with multiple patterns
        let nextApptDate = null;
        const datePatterns = [
            /[0-9]{2}\/[0-9]{2}\/[0-9]{4}/,
            /[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}/,
            /[0-9]{4}-[0-9]{2}-[0-9]{2}/,
            /[A-Za-z]+ [0-9]{1,2},? [0-9]{4}/
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
