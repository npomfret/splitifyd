async function globalTeardown() {
  console.log('🧹 Starting e2e test global teardown...');
  
  // Nothing to clean up - each worker manages its own pool
  console.log('✅ Global teardown completed');
}

export default globalTeardown;