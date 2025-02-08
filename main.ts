import { Actor } from 'apify';
import { chromium, Browser, Page } from '@playwright/test';
import log from '@apify/log';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

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

// Define input interface for better type safety
interface ActorInput {
    patientName?: string;
    medications?: string[];
    email?: string;
    password?: string;
    screenWidth?: number;
    screenHeight?: number;
    headful?: boolean;
    timeout?: number;
    darkMode?: boolean;
    locale?: string;
    video?: string;
    /**
     * If provided, this string of test code will be written out to a test file
     * and run instead of the default test spec.
     */
    testCode?: string;
}

(async () => {
    await Actor.init();
    
    // Get input with type safety
    const input = await Actor.getInput() as ActorInput;
    
    // Process input parameters
    const patientName = input.patientName || 'Default Patient';
    const medications = Array.isArray(input.medications) ? input.medications : [];
    const email = input.email || process.env.EMAIL;
    const password = input.password || process.env.PASSWORD;

    if (!email || !password || !patientName || medications.length === 0) {
        throw new Error('Missing required parameters: email, password, patientName, medications');
    }

    log.info('Starting actor', {
        patientName,
        medicationsCount: medications.length
    });

    try {
        // Launch browser
        const browser = await chromium.launch({
            headless: !input.headful,
        });
        
        // Create new page
        const page = await browser.newPage({
            viewport: {
                width: input.screenWidth || 1280,
                height: input.screenHeight || 720
            }
        });

        // 📋 Log test start
        log.info('Starting test automation', { timestamp: new Date().toISOString() });

        // 🔐 1. Log in
        log.info('Attempting login', { email });
        await page.goto('https://www.simplepractice.com');
        
        // Wait for and click sign in button
        const signInButton = page.getByTestId('signIn-tryItFree-wrapper').getByRole('link', { name: 'Sign in' });
        await signInButton.waitFor({ state: 'visible', timeout: 5000 });
        await signInButton.click();
        log.info('Clicked sign in button');

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
        log.info('Waiting for login to complete');
        const searchInput = page.getByPlaceholder('Search clients');
        await searchInput.waitFor({ state: 'visible', timeout: 30000 });
        log.info('Login successful');
        
        // 🔍 2. Search for patient
        log.info('Searching for patient', { patientName });
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
        log.info('Patient found', { patientName });

        // 📅 3. Find next appointment
        log.info('Looking for next appointment');
        const nextApptElement = await page.getByText('Next Appt', { exact: false });
        await nextApptElement.waitFor({ state: 'visible', timeout: 10000 });
        const nextApptText = await nextApptElement.textContent();
        log.info('Found appointment text', { text: nextApptText });
        const nextApptDate = nextApptText?.match(/\d{2}\/\d{2}\/\d{4}/)?.[0];

        // ⏰ 4. Calculate days and prepare message
        const today = new Date();
        let diffDays = 0;
        let appointmentMessage = '';

        if (nextApptDate) {
            const apptDate = new Date(nextApptDate);
            const diffTime = Math.abs(apptDate.getTime() - today.getTime());
            diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            appointmentMessage = `❓ Would you like me to proceed with a ${diffDays + 5}-day supply for the patient?`;
        } else {
            log.warning('No future appointment found');
            appointmentMessage = `⚠️ NO FUTURE APPOINTMENT SCHEDULED\n❓ How would you like to proceed with this patient's medication refill?`;
        }
        
        // 📝 5. Generate message
        const requestId = uuidv4().substring(0, 9);
        const currentTime = today.toLocaleString('en-US');
        
        const message = `📋 MEDICATION REFILL REQUEST

👤 PATIENT NAME: ${patientName}
💊 MEDICATIONS: ${medications.join(', ').toLowerCase()}
📅 NEXT APPOINTMENT: ${nextApptDate || 'NOT SCHEDULED'}
⏰ CALCULATED AT: ${currentTime}
🔍 REQUEST ID: ${requestId}

${appointmentMessage}`;

        // Store results
        const testResults = {
            patientName,
            medications: medications.join(', ').toLowerCase(),
            nextAppointment: nextApptDate || null,
            requestId,
            calculatedAt: currentTime,
            message
        };

        // Store in dataset
        const dataset = await Actor.openDataset();
        await dataset.pushData(testResults);
        log.info('Test results stored in dataset');
        
        // Close browser
        await browser.close();
        log.info('Test completed successfully');

    } catch (error) {
        log.error('Test failed', { error: error instanceof Error ? error.message : String(error) });
        
        // Take error screenshot if we have a page object
        try {
            const browser = await chromium.launch();
            const page = await browser.newPage();
            await page.screenshot({ 
                path: 'error-state.png',
                fullPage: true 
            });
            
            // Store error screenshot
            const kvs = await Actor.openKeyValueStore();
            const screenshotBuffer = fs.readFileSync('error-state.png');
            await kvs.setValue('ERROR_SCREENSHOT', screenshotBuffer, { contentType: 'image/png' });
            log.info('Error screenshot stored in key-value store');
            
            await browser.close();
        } catch (screenshotError) {
            log.error('Failed to capture error screenshot', { error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError) });
        }
        
        throw error;
    }

    await Actor.exit();
})();
