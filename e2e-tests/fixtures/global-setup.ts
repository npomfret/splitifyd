import { chromium, FullConfig } from '@playwright/test';
import { getUserPool } from './user-pool.fixture';
import { HOSTING_PORT } from '../helpers/emulator-utils';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting e2e test global setup...');

  // Create a browser for user pool initialization with same config as tests
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: `http://localhost:${HOSTING_PORT}`
  });
  const page = await context.newPage();

  try {
    // Test basic connectivity first
    console.log(`Testing connectivity to http://localhost:${HOSTING_PORT}`);
    await page.goto(`http://localhost:${HOSTING_PORT}`);
    await page.waitForLoadState('networkidle');
    console.log('✅ Basic connectivity confirmed');
    
    // Test register page accessibility
    console.log('Testing register page navigation...');
    await page.goto(`http://localhost:${HOSTING_PORT}/register`);
    await page.waitForLoadState('networkidle');
    console.log('✅ Register page accessible');
    
    // Initialize and pre-warm the user pool - fail fast if this doesn't work
    const userPool = await getUserPool();
    await userPool.preWarmPool(page);
    
    const stats = userPool.getPoolStats();
    console.log(`✅ User pool initialized: ${stats.total} users, ${stats.available} available`);
    console.log('✅ Global setup completed');
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;