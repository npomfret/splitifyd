import { FullConfig } from '@playwright/test';
import { getUserPool, resetUserPool } from './user-pool.fixture';

async function globalTeardown() {
  console.log('🧹 Starting e2e test global teardown...');

  try {
    // Cleanup the user pool
    const userPool = await getUserPool();
    await userPool.cleanupPool();
    
    // Reset global pool instance
    resetUserPool();
    
    console.log('✅ User pool cleaned up');
  } catch (error) {
    console.error('❌ Error during global teardown:', error);
  }

  console.log('✅ Global teardown completed');
}

export default globalTeardown;