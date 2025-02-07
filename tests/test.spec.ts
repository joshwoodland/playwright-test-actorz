import { test, expect } from '@playwright/test';
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
        await page.goto('https://www.simplepractice.com');
        await page.click('text=Sign In');
        
        // Use credentials from environment variables
        await page.getByLabel('Email').click();
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').click();
        await page.getByLabel('Password').fill(password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        
        // Wait for login to complete
        await page.waitForURL('https://secure.simplepractice.com/**');
        console.log('✅ Login successful');
        
        // 🔍 2. Search for patient
        console.log('🔎 Searching for patient:', patientName);
        await page.getByPlaceholder('Search').fill(patientName);
        await page.keyboard.press('Enter');
        await page.getByRole('link', { name: patientName }).click();
        
        // Wait for patient page to load
        await page.waitForLoadState('networkidle');
        console.log('✅ Patient found');

        // 📅 3. Find next appointment
        console.log('🔍 Looking for next appointment...');
        const nextApptElement = await page.getByText('next appt', { exact: false });
        const nextApptText = await nextApptElement.textContent();
        const nextApptDate = nextApptText?.match(/\d{2}\/\d{2}\/\d{4}/)?.[0];

        // ⏰ 4. Calculate days and prepare message
        const today = new Date();
        let diffDays = 0;
        let appointmentMessage = '';

        if (nextApptDate) {
            const apptDate = new Date(nextApptDate);
            const diffTime = Math.abs(apptDate.getTime() - today.getTime());
            diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            appointmentMessage = `📅 NEXT APPOINTMENT: ${nextApptDate}\n❓ Would you like me to proceed with a ${diffDays + 5}-day supply for the patient?`;
        } else {
            console.log('⚠️ No future appointment found');
            appointmentMessage = `⚠️ NO FUTURE APPOINTMENT SCHEDULED\n❓ How would you like to proceed with this patient's medication refill?`;
        }
        
        // 📝 5. Generate message
        const requestId = uuidv4().substring(0, 9);
        const currentTime = today.toLocaleString('en-US');
        
        const message = `📋 MEDICATION REFILL REQUEST

👤 PATIENT NAME: ${patientName}
💊 MEDICATIONS: ${medications.join(', ').toLowerCase()}
⏰ CALCULATED AT: ${currentTime}
🔍 REQUEST ID: ${requestId}

${appointmentMessage}`;

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
            path: path.join('test-results', `patient-details-${process.env.ACTOR_RUN_ID || 'test'}.png`),
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
        
        await page.screenshot({ 
            path: path.join('test-results', `error-state-${process.env.ACTOR_RUN_ID || 'test'}.png`),
            fullPage: true 
        });
        
        throw error;
    }
});