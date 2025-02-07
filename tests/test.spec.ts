import { test, expect } from '@playwright/test';

test('Dynamic patient data automation', async ({ page }) => {
    // 📥 1. Access environment variables
    const email = process.env.EMAIL;
    const password = process.env.PASSWORD;
    const patientName = process.env.PATIENT_NAME;
    const medications = process.env.MEDICATIONS;

    // 🔐 2. Log in
    await page.goto('https://www.simplepractice.com');
    await page.click('text=Sign In');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button:has-text("Sign In")');

    // 📝 3. Use patient data dynamically
    await page.waitForSelector('#dashboard');

    await page.click('#add-patient-button');
    await page.fill('#patient-name', patientName);
    await page.fill('#medications', medications);
    await page.click('#save-button');

    // ✅ 4. Verify
    await expect(page.locator('#confirmation')).toHaveText('Patient added successfully!');
});
