import { chromium } from '@playwright/test';
import {EMULATOR_URL} from '../helpers/emulator-utils';

async function globalSetup() {
  console.log('🚀 Starting e2e test global setup...');

  // Create a browser just to test connectivity
  const browser = await chromium.launch();
  const baseURL = EMULATOR_URL;
  const context = await browser.newContext({
    baseURL: baseURL
  });
  const page = await context.newPage();

  try {
    // Test basic connectivity first
    console.log(`Testing connectivity to ${baseURL}`);
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    console.log('✅ Basic connectivity confirmed');
    
    // Test register page accessibility (critical for user creation)
    console.log('Testing register page navigation...');
    await page.goto(`${baseURL}/register`);
    await page.waitForLoadState('networkidle');
    console.log('✅ Register page accessible');
    
    // That's it! Each worker will create users on-demand
    console.log('✅ Global setup completed - workers will create users on-demand');
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;