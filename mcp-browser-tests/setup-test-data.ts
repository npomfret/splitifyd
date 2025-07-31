#!/usr/bin/env npx tsx

import { ApiDriver } from '../firebase/functions/__tests__/support/ApiDriver';
import { TEST_CREDENTIALS } from './lib/browser-test-base';

async function setupTestData() {
  console.log('Setting up test data for browser tests...');
  const apiDriver = new ApiDriver();
  
  try {
    // Create test users
    const users = [];
    for (let i = 1; i <= 3; i++) {
      const creds = TEST_CREDENTIALS[`user${i}` as keyof typeof TEST_CREDENTIALS];
      console.log(`Creating user ${i}: ${creds.email}`);
      const user = await apiDriver.createUser({
        email: creds.email,
        password: creds.password,
        displayName: creds.displayName
      });
      users.push(user);
    }
    
    // Create test group
    console.log('Creating test group...');
    const group = await apiDriver.createGroupWithMembers(
      'Test Expense Group',
      users,
      users[0].token
    );
    
    console.log(`✅ Test data created successfully!`);
    console.log(`Group ID: ${group.id}`);
    console.log(`Users: ${users.map(u => u.email).join(', ')}`);
    
    return { users, group };
  } catch (error) {
    console.error('Failed to set up test data:', error);
    throw error;
  }
}

if (require.main === module) {
  setupTestData().catch(console.error);
}

export { setupTestData };